'use client';

import { useId } from 'react';
import { petProgress, petStageName, type PetBranch } from '@/lib/cinema-pet';

export default function CinemaPetArt({ experience, branch, accessory = 'none', name = 'Поппи' }: { experience: number; branch: PetBranch; accessory?: string; name?: string }) {
  const id = useId().replace(/:/g, '');
  const { stage } = petProgress(experience);
  const puffy = stage > 0;
  return <svg viewBox="0 0 320 280" className={`cinema-pet-art pet-art-stage-${stage}`} role="img" aria-label={`${name} — ${petStageName(experience, branch)}`}>
    <defs><radialGradient id={`glow-${id}`}><stop offset="0" stopColor="var(--pet-accent, #b79aff)" stopOpacity=".4" /><stop offset="1" stopColor="var(--pet-accent, #b79aff)" stopOpacity="0" /></radialGradient><linearGradient id={`kernel-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0bb" /><stop offset="1" stopColor="#d59a47" /></linearGradient><linearGradient id={`bucket-${id}`} x2="0" y2="1"><stop stopColor="var(--pet-accent, #b79aff)" /><stop offset="1" stopColor="#5c458a" /></linearGradient></defs>
    <ellipse cx="160" cy="155" rx="145" ry="115" fill={`url(#glow-${id})`} />
    <ellipse cx="160" cy="248" rx="82" ry="12" fill="#060910" opacity=".5" />
    <g className="pet-float">
      {stage >= 3 && <g fill="var(--pet-accent, #b79aff)" opacity=".7"><path d="m57 82 3 8 8 3-8 3-3 8-3-8-8-3 8-3zM256 58l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" /><circle cx="269" cy="137" r="3" /><circle cx="63" cy="177" r="3" /></g>}
      {stage >= 2 && <g stroke="#e1bd89" strokeWidth="10" strokeLinecap="round"><path d="M113 181 91 192M207 181l22-14" /><path d="m140 223-5 16m47-16 5 16" /></g>}
      {stage >= 2 && <g><path d="M111 164h98l-13 63q-35 17-72 0z" fill={`url(#bucket-${id})`} stroke="#e3ceff" strokeOpacity=".5" strokeWidth="2" /><path d="m138 171 4 57m25-57-1 60m28-60-7 57" stroke="#f7f1ff" strokeOpacity=".35" strokeWidth="10" /><rect x="128" y="185" width="64" height="24" rx="5" fill="#1b172b" /><path d="m138 190 7 4-7 4m15-8 7 4-7 4m15-8 7 4-7 4" stroke="#f0c674" strokeWidth="2" fill="none" /></g>}
      {stage === 5 && branch === 'monster' && <g fill="#f0c674"><path d="m108 82-11-29 30 19m65 4 29-24-7 39" /><path d="m94 161-17 17 21-5m124-12 18 17-23-4" /></g>}
      {puffy ? <path d="M100 143c-24-4-24-37-5-44-12-28 18-45 36-33 8-32 45-33 57-4 30-18 58 7 46 32 29 13 24 47 0 53 5 29-27 46-47 29-20 24-58 17-64-6-17 10-35-6-23-27z" fill={`url(#kernel-${id})`} stroke="#fbe9c7" strokeWidth="3" /> : <g><path d="M115 165c-9-35 9-83 43-87 36-4 61 39 49 81-8 31-30 55-50 52-22-2-35-23-42-46z" fill={`url(#kernel-${id})`} stroke="#f9dfaa" strokeWidth="3" /><path d="M159 87q-25 62-5 114" stroke="#d49b50" strokeWidth="6" fill="none" opacity=".55" /></g>}
      <g className="pet-eyes" fill="#292239"><ellipse cx="139" cy="128" rx="6" ry="9" /><ellipse cx="181" cy="128" rx="6" ry="9" /><circle cx="141" cy="125" r="2" fill="white" /><circle cx="183" cy="125" r="2" fill="white" /></g>
      <ellipse cx="122" cy="145" rx="9" ry="5" fill="#ed9c91" opacity=".5" /><ellipse cx="198" cy="145" rx="9" ry="5" fill="#ed9c91" opacity=".5" />
      <path d={stage === 5 && branch === 'monster' ? 'M147 149q13 23 27 0z' : 'M149 151q12 11 24-1'} fill={stage === 5 && branch === 'monster' ? '#5a3148' : 'none'} stroke="#63482e" strokeWidth="3" strokeLinecap="round" />
      {stage === 5 && branch === 'monster' && <path d="m153 151 4 7 4-7m5 0 4 7 3-7" fill="#fff7dd" />}
      {accessory === 'bowtie' && <g fill="#ee7da8" stroke="#ffe2ef" strokeWidth="1"><path d="m156 175-18-9v22l18-7m8-6 18-9v22l-18-7" /><circle cx="160" cy="178" r="6" /></g>}
      {accessory === 'glasses' && <g stroke="#292239" strokeWidth="5"><rect x="124" y="117" width="30" height="23" rx="6" fill="#61cbe2" fillOpacity=".75" /><rect x="168" y="117" width="30" height="23" rx="6" fill="#ef739f" fillOpacity=".75" /><path d="M154 126h14" /></g>}
      {(accessory === 'cap' || (stage === 5 && branch === 'director' && accessory !== 'crown')) && <g><ellipse cx="162" cy="62" rx="47" ry="20" fill="#31283b" /><path d="M118 67q45 17 88-1" stroke="#b79aff" strokeWidth="7" /><path d="m168 45 4-8" stroke="#31283b" strokeWidth="6" /></g>}
      {accessory === 'crown' && <path d="m126 66-6-30 22 12 18-24 17 24 23-13-7 31z" fill="#f0c674" stroke="#fff0b9" strokeWidth="2" />}
      {stage === 5 && branch === 'director' && <g transform="translate(211 175) rotate(-14)"><rect width="40" height="32" rx="4" fill="#211d2b" stroke="#dcc9ff" /><path d="M0 8h40m-34-8 7 8m5-8 7 8m5-8 7 8" stroke="#dcc9ff" strokeWidth="3" /></g>}
    </g>
    <path d="M50 258h220" stroke="var(--pet-accent, #b79aff)" strokeOpacity=".4" />
  </svg>;
}
