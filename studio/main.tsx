import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArtCard } from '../src/react';
import { BACKGROUNDS, THEME_FAMILIES, THEME_FAMILY_LABELS, createCardRecipe, parseCardRecipe, renderCardBlob, type CardRecipe, type DateStyle } from '../src/index';
import './style.css';

const storageKey = 'hada-card-studio-v1';
const initial = () => createCardRecipe({ background: 'current', seed: 7023,
  colors: ['#173b45', '#46766d', '#b9be91', '#e4c5a0', '#c77867'], date: '2026-10-23' });
function restore(): CardRecipe {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return initial();
    const recipe = parseCardRecipe(saved);
    if (!BACKGROUNDS.some(background => background.id === recipe.theme)) return initial();
    return recipe;
  } catch { return initial(); }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function App() {
  const [recipe, setRecipe] = useState(restore);
  const [family, setFamily] = useState<string>(() => BACKGROUNDS.find(b => b.id === recipe.theme)!.family);
  const [animate, setAnimate] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [showDate, setShowDate] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const current = BACKGROUNDS.find(background => background.id === recipe.theme)!;
  const update = (change: Partial<CardRecipe>) => { setRecipe(previous => ({ ...previous, ...change })); setError(''); };
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(recipe)); }
    catch { /* Editing remains usable when storage is unavailable. */ }
  }, [recipe]);
  function changeColor(index: number, change: Partial<CardRecipe['colors'][number]>) {
    update({ colors: recipe.colors.map((color, i) => i === index ? { ...color, ...change } : color) });
  }
  async function exportPng() {
    setExporting(true); setError('');
    try {
      download(await renderCardBlob(recipe, { backgroundOnly: !showDate }), `hada-${recipe.theme}-${recipe.date || recipe.seed}.png`);
    } catch { setError('이미지를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setExporting(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('size');
      const next = parseCardRecipe(await file.text());
      const background = BACKGROUNDS.find(item => item.id === next.theme);
      if (!background) throw new Error('background');
      setRecipe(next); setFamily(background.family); setError('');
    } catch { setError('유효한 카드 JSON 파일을 선택해 주세요.'); }
    if (upload.current) upload.current.value = '';
  }
  return <>
    <header className="site-header"><a className="wordmark" href="./" aria-label="HADA Card Studio 홈">HADA<span>CARDS</span></a>
      <a className="repo-link" href="https://github.com/wl39/hada-cards" target="_blank" rel="noreferrer">GitHub ↗</a></header>
    <main className="workspace">
      <section className="preview-panel" aria-label="카드 미리보기">
        <div className="preview-heading"><span className="eyebrow">CARD STUDIO</span><span className="edition">01 — COMPOSE</span></div>
        <div className="card-stage"><ArtCard recipe={recipe} animate={animate} showDate={showDate} className="studio-card"/></div>
        <div className="preview-bottom"><div><span className="eyebrow">{current.family.toUpperCase()}</span><h1>{current.label}</h1></div>
          <button className="motion" type="button" aria-pressed={animate} aria-label={animate ? '애니메이션 일시 정지' : '애니메이션 재생'} onClick={() => setAnimate(!animate)}>{animate ? 'Ⅱ' : '▷'}</button></div>
        <div className="actions"><button className="primary" onClick={exportPng} disabled={exporting}>{exporting ? '저장 중…' : 'PNG 저장'}<span>↓</span></button>
          <button onClick={() => download(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }), 'hada-card.json')}>JSON 저장</button>
          <button onClick={() => upload.current?.click()}>불러오기</button></div>
        <input ref={upload} type="file" accept=".json,application/json" hidden onChange={event => void importFile(event.target.files?.[0])}/>
        {error && <p role="alert" className="error">{error}</p>}
      </section>
      <section className="controls" aria-label="카드 편집">
        <div className="section-title"><h2>배경</h2><span className="count">{BACKGROUNDS.length}</span></div>
        <div className="family-tabs" aria-label="배경 분류">{THEME_FAMILIES.map(value => <button key={value} aria-pressed={family === value} onClick={() => setFamily(value)}>{THEME_FAMILY_LABELS[value].ko}</button>)}</div>
        <div className="background-grid">{BACKGROUNDS.filter(background => background.family === family).map(background => <button className="background-choice" key={background.id} aria-pressed={recipe.theme === background.id} onClick={() => update({ theme: background.id })}>
          <ArtCard recipe={{ ...recipe, theme: background.id }} className="background-thumb"/><span>{background.label}</span></button>)}</div>
        <div className="section-title colors-title"><h2>색상</h2><button className="text-button" disabled={recipe.colors.length >= 8} aria-label="색상 추가" onClick={() => update({ colors: [...recipe.colors, { color: '#d4a2a7', weight: 1, completed: 1 }] })}>＋ 추가</button></div>
        <div className="color-head"><span>색</span><span>비율</span><span>밝기</span><span/></div>
        <div className="colors">{recipe.colors.map((color, index) => <div className="color-row" key={index}>
          <label className="color-input"><input type="color" value={color.color} aria-label={`색상 ${index + 1}`} onInput={event => changeColor(index, { color: event.currentTarget.value })}/><span>{color.color.toUpperCase()}</span></label>
          <input className="weight" type="number" min="0.1" max="100" step="0.1" value={color.weight} aria-label={`색상 ${index + 1} 비율`} onChange={event => { const weight = Number(event.target.value); if (weight >= .1 && weight <= 100) changeColor(index, { weight, completed: weight * (color.weight ? color.completed / color.weight : 1) }); }}/>
          <input type="range" min="0" max="100" value={color.weight ? Math.round(color.completed / color.weight * 100) : 0} aria-label={`색상 ${index + 1} 밝기`} onChange={event => changeColor(index, { completed: color.weight * Number(event.target.value) / 100 })}/>
          <button className="remove" aria-label={`색상 ${index + 1} 삭제`} disabled={recipe.colors.length <= 1} onClick={() => update({ colors: recipe.colors.filter((_, i) => i !== index) })}>×</button>
        </div>)}</div>
        <div className="section-title"><h2>날짜 · 문구</h2><label className="toggle"><input type="checkbox" checked={showDate} onChange={event => setShowDate(event.target.checked)}/><span>표시</span></label></div>
        <div className="date-fields"><label><span>날짜</span><input type="date" value={recipe.date} min="0001-01-01" max="9999-12-31" onInput={event => update({ date: event.currentTarget.value })}/></label>
          <label><span>표기</span><select value={recipe.dateStyle} onChange={event => update({ dateStyle: event.target.value as DateStyle })}><option value="en">Oct 23</option><option value="numeric">10.23</option><option value="ko">10월 23일</option></select></label></div>
        <label className="caption"><span>문구</span><input value={recipe.caption ?? ''} placeholder="" maxLength={120} onChange={event => update({ caption: event.target.value })}/></label>
        <div className="seed-row"><label><span>시드</span><input type="number" min="0" max="99999999" step="1" value={recipe.seed} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0 && value <= 99999999) update({ seed: value }); }}/></label>
          <button aria-label="새 시드" onClick={() => update({ seed: crypto.getRandomValues(new Uint32Array(1))[0] % 100000 })}>↻</button>
          <button className="reset" onClick={() => { setRecipe(initial()); setFamily('fluid'); setShowDate(true); setError(''); }}>초기화</button></div>
      </section>
    </main>
    <footer><span>HADA CARDS</span><span>{BACKGROUNDS.length} backgrounds · Independent by design</span><a href="https://github.com/wl39/hada-cards#usage">API ↗</a></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
