import './brand-logo.css';
import { wordmarkPath, wordmarkViewBox } from './brand-wordmark';

export function BrandMark({ size = 28, inverse = false, decorative = true, className = '' }) {
  return <img className={`vpylab-brand-mark ${className}`} src={inverse ? '/brand/vpylab-mark-inverse.svg' : '/brand/vpylab-mark.svg'} width={size} height={size} alt={decorative ? '' : 'VPyLab'} aria-hidden={decorative || undefined} draggable="false" />;
}

export default function BrandLogo({ size = 28, inverse = false, className = '' }) {
  return <span role="img" aria-label="VPyLab" className={`vpylab-brand ${inverse ? 'vpylab-brand-inverse' : ''} ${className}`}><BrandMark size={size} inverse={inverse} /><svg className="vpylab-brand-wordmark" viewBox={wordmarkViewBox} aria-hidden="true" focusable="false"><path d={wordmarkPath} fill="currentColor" /></svg></span>;
}
