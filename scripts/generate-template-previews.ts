
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { browserService } from "../src/infrastructure/pdf/browser.service";
import { renderClassicTemplate } from "../src/infrastructure/pdf/templates/classic.template";
import { renderModernTemplate } from "../src/infrastructure/pdf/templates/modern.template";
import { renderMinimalTemplate } from "../src/infrastructure/pdf/templates/minimal.template";
import { ReportCardTemplateData } from "../src/infrastructure/pdf/templates/classic.template";

const DUMMY_DATA: ReportCardTemplateData = {
	school: {
		name: "Greenfield Academy",
		logoUrl: null,
		motto: "Excellence in Education",
		address: "12 Freedom Way, Lagos",
	},
	student: {
		firstName: "Adaeze",
		lastName: "Okafor",
		admissionNumber: "GA/2024/041",
		photoUrl: null,
		gender: "female",
	},
	className: "JSS 2",
	sessionName: "2025/2026",
	termName: "Second Term",
	subjects: [
		{
			subjectName: "Mathematics",
			caScore: 28,
			examScore: 60,
			total: 88,
			grade: "A1",
			remark: "Excellent",
		},
		{
			subjectName: "English Language",
			caScore: 24,
			examScore: 52,
			total: 76,
			grade: "A1",
			remark: "Excellent",
		},
		{
			subjectName: "Basic Science",
			caScore: 20,
			examScore: 45,
			total: 65,
			grade: "B3",
			remark: "Good",
		},
	],
	totalScore: 229,
	averageScore: 76.3,
	position: 3,
	totalStudents: 42,
	teacherRemark: "A hardworking and consistent student.",
	principalRemark: "Keep up the good work.",
	branding: {
		primaryColor: "#1a1a2e",
		secondaryColor: null,
		stampUrl: null,
		signatureUrl: null,
	},
};

async function main() {
	const outputDir = join(
		process.cwd(),
		"public",
		"template-previews",
	);

	// Create the output directory if it doesn't exist.
	mkdirSync(outputDir, { recursive: true });

	const templates = [
		{ name: "classic", render: renderClassicTemplate },
		{ name: "modern", render: renderModernTemplate },
		{ name: "minimal", render: renderMinimalTemplate },
	];

	const browser = await browserService.getBrowser();

	try {
		for (const t of templates) {
			const html = t.render(DUMMY_DATA);

			const page = await browser.newPage();

			await page.setViewport({
				width: 800,
				height: 1131,
			});

			await page.setContent(html, {
				waitUntil: "load",
			});

			const screenshot = await page.screenshot({
				type: "png",
			});

			writeFileSync(
				join(outputDir, `${t.name}.png`),
				screenshot,
			);

			await page.close();

			console.log(`✅ ${t.name} preview generated`);
		}
	} finally {
		await browserService.shutdown();
	}
}

main().catch((error) => {
	console.error("❌ Failed to generate template previews:", error);
	process.exit(1);
});
