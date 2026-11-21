import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { Providers } from "./providers";
import { COMPANY } from "@/config/company";
import { Toaster } from "sonner";
import "./globals.css";

/*
| Two variable fonts, self-hosted at build time (no request to Google from the browser).
| latin-ext is included because money is shown in naira (the ₦ sign lives in that range).
| UI and body: Source Sans 3. Display and page titles only: Newsreader. Why: docs/UI_UX_REDESIGN.md.
*/
const sourceSans = Source_Sans_3({
	variable: "--font-source-sans",
	subsets: ["latin", "latin-ext"],
	display: "swap",
});

const newsreader = Newsreader({
	variable: "--font-newsreader",
	subsets: ["latin", "latin-ext"],
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: new URL(COMPANY.website),
	title: {
		default: `${COMPANY.name} — ${COMPANY.tagline}`,
		template: `%s | ${COMPANY.name}`,
	},
	description: COMPANY.description,
	keywords: [
		"school management software Nigeria",
		"school portal Nigeria",
		"student information system Nigeria",
		"WAEC grading software",
		"school fee management software",
		"attendance software for schools",
		"digital report card Nigeria",
	],
	authors: [{ name: COMPANY.legal.companyName }],
	creator: COMPANY.legal.companyName,
	publisher: COMPANY.legal.companyName,
	icons: {
		icon: "/favicon.ico",
	},
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: COMPANY.name,
	},
	openGraph: {
		type: "website",
		locale: "en_NG",
		url: COMPANY.website,
		siteName: COMPANY.name,
		title: `${COMPANY.name} — ${COMPANY.tagline}`,
		description: COMPANY.description,
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: COMPANY.name,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `${COMPANY.name} — ${COMPANY.tagline}`,
		description: COMPANY.description,
		images: ["/og-image.png"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
};

export const viewport = {
	themeColor: "#1F7A4D",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${sourceSans.variable} ${newsreader.variable} h-full antialiased`} suppressHydrationWarning>
			<body className="flex min-h-full flex-col">
				<Toaster
					position="top-right"
					richColors
					closeButton
				/>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
