export function HeroIllustration() {
	return (
		<svg
			viewBox="0 0 560 420"
			className="h-auto w-full max-w-xl"
			xmlns="http://www.w3.org/2000/svg"
		>
			{/* Paper ledger — left side */}
			<g transform="rotate(-4 140 210)">
				<rect x="20" y="40" width="240" height="340" rx="6" fill="oklch(0.97 0.01 90)" stroke="oklch(0.85 0.02 90)" strokeWidth="1.5" />
				{/* ruled lines */}
				{Array.from({ length: 11 }).map((_, i) => (
					<line key={i} x1="36" y1={80 + i * 28} x2="244" y2={80 + i * 28} stroke="oklch(0.88 0.02 90)" strokeWidth="1" />
				))}
				{/* margin rule */}
				<line x1="56" y1="40" x2="56" y2="380" stroke="oklch(0.7 0.15 25 / 0.4)" strokeWidth="1.5" />
				{/* handwritten-ish tally marks / messy entries */}
				<g stroke="oklch(0.3 0.03 160)" strokeWidth="2" strokeLinecap="round" fill="none">
					<path d="M70 76 L120 76" />
					<path d="M70 104 L100 104 M104 104 L140 104" />
					<path d="M70 132 L150 132" strokeDasharray="4 3" />
					<path d="M70 160 L90 160" />
				</g>
				{/* correction scribble */}
				<path d="M170 128 Q185 118 200 130 Q185 140 172 132" stroke="oklch(0.55 0.18 25)" strokeWidth="2" fill="none" strokeLinecap="round" />
				<circle cx="230" cy="60" r="10" fill="none" stroke="oklch(0.55 0.16 145)" strokeWidth="1.5" opacity="0.3" />
			</g>

			{/* Arrow */}
			<g transform="translate(255 190)">
				<path d="M0 20 L60 20" stroke="oklch(0.55 0.16 145)" strokeWidth="2.5" strokeLinecap="round" />
				<path d="M48 8 L64 20 L48 32" stroke="oklch(0.55 0.16 145)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			</g>

			{/* Digital table — right side */}
			<g transform="translate(320 40)">
				<rect x="0" y="0" width="220" height="340" rx="12" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
				{/* header row */}
				<rect x="0" y="0" width="220" height="44" rx="12" fill="oklch(0.55 0.16 145 / 0.12)" />
				<rect x="0" y="32" width="220" height="12" fill="oklch(0.55 0.16 145 / 0.12)" />
				<text x="18" y="27" fontSize="12" fontWeight="600" fill="oklch(0.3 0.05 160)" fontFamily="ui-sans-serif, system-ui">
					Student Grades
				</text>

				{/* rows */}
				{[
					{ name: "Adaeze O.", grade: "A1", color: "oklch(0.6 0.15 155)" },
					{ name: "Bello T.", grade: "B2", color: "oklch(0.6 0.15 200)" },
					{ name: "Chika N.", grade: "C4", color: "oklch(0.78 0.16 75)" },
					{ name: "Femi A.", grade: "A1", color: "oklch(0.6 0.15 155)" },
					{ name: "Grace I.", grade: "B3", color: "oklch(0.6 0.15 200)" },
				].map((row, i) => (
					<g key={row.name} transform={`translate(0 ${60 + i * 50})`}>
						<line x1="16" y1="40" x2="204" y2="40" stroke="var(--border)" strokeWidth="1" />
						<circle cx="28" cy="16" r="12" fill="oklch(0.55 0.16 145 / 0.15)" />
						<text x="28" y="20" fontSize="10" fontWeight="600" textAnchor="middle" fill="oklch(0.35 0.05 160)" fontFamily="ui-sans-serif, system-ui">
							{row.name.charAt(0)}
						</text>
						<text x="48" y="20" fontSize="12" fill="var(--foreground)" fontFamily="ui-sans-serif, system-ui">
							{row.name}
						</text>
						<rect x="170" y="6" width="28" height="20" rx="5" fill={row.color} opacity="0.15" />
						<text x="184" y="20" fontSize="11" fontWeight="700" textAnchor="middle" fill={row.color} fontFamily="ui-monospace, monospace">
							{row.grade}
						</text>
					</g>
				))}
			</g>
		</svg>
	);
}