/** The two open pages form the branching Y at the heart of YAVN. */
export function YavnLogo({ compact = false }: { compact?: boolean }) {
  return (
    <svg className="yavn-logo" viewBox={compact ? '0 0 40 42' : '0 0 180 42'} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M3 5 18 13v24L3 29V5Zm19 8L37 5v24l-15 8V13Z" />
      <path className="yavn-logo-spark" d="m20 0 4 4-4 4-4-4 4-4Z" />
      {!compact && (
        <g>
          <path d="m51 9 8 13 8-13h8L63 29v8h-8v-8L43 9h8Z" />
          <path fillRule="evenodd" d="m86 9 12 28h-8l-2-5H77l-2 5h-8L79 9h7Zm-3.5 8-3.5 9h7l-3.5-9Z" />
          <path d="m103 9 8 19 8-19h8l-12 28h-8L95 9h8Zm27 0h7l16 17V9h8v28h-7l-16-17v17h-8V9Z" />
          <circle className="yavn-logo-spark" cx="172" cy="33" r="4" />
        </g>
      )}
    </svg>
  );
}
