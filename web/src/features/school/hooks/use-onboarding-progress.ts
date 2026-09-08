import { useMySchool } from "./use-school";
import { useMyDocuments } from "./use-school-document";
import {
	useClasses,
	useSubjects,
} from "@/features/classes/hooks/use-classes";
import { useStudents } from "@/features/students/hooks/use-students";
import { useCurrentSession } from "./use-sessions";

export type OnboardingStepKey =
	| "documents"
	| "business-info"
	| "payment"
	| "academic-session"
	| "structure"
	| "students"
	| "done";

export interface OnboardingProgress {
	currentStep: OnboardingStepKey;
	currentStepNumber: number;
	totalSteps: number;
	isComplete: boolean;
	isLoading: boolean;
	completed: Record<OnboardingStepKey, boolean>;
}

const STEP_ORDER: OnboardingStepKey[] = [
	"documents",
	"business-info",
	"payment",
	"academic-session",
	"structure",
	"students",
];

export function useOnboardingProgress(): OnboardingProgress {
	const {
		data: school,
		isLoading: schoolLoading,
	} = useMySchool({ poll: true });

	const {
		isLoading: docsLoading,
	} = useMyDocuments();

	const {
		data: classes,
		isLoading: classesLoading,
	} = useClasses();

	const {
		data: subjects,
		isLoading: subjectsLoading,
	} = useSubjects();

	const {
		data: currentSession,
		isLoading: sessionLoading,
	} = useCurrentSession();

	const {
		data: studentsData,
		isLoading: studentsLoading,
	} = useStudents({ limit: 1 });

	const isLoading =
		schoolLoading ||
		docsLoading ||
		classesLoading ||
		subjectsLoading ||
		sessionLoading ||
		studentsLoading;

	const isVerified =
		school?.verificationStatus === "verified";

	const hasBusinessInfo = Boolean(
		school?.address && school?.phone,
	);

	const hasPayment =
		Boolean(school?.paymentSetupComplete);

	/**
	 * Classes and subjects are no longer separate onboarding
	 * steps. They together determine whether the Structure step
	 * has been completed.
	 */
	const hasClasses =
		(classes?.length ?? 0) > 0;

	const hasSubjects =
		(subjects?.length ?? 0) > 0;

	const hasStructure =
		hasClasses && hasSubjects;

	/**
	 * Academic session is complete once a current session exists.
	 */
	const hasAcademicSession =
		Boolean(currentSession);

	const hasStudents =
		(studentsData?.meta?.total ?? 0) > 0;

	const completed: Record<
		OnboardingStepKey,
		boolean
	> = {
		documents: isVerified,
		"business-info": hasBusinessInfo,
		payment: hasPayment,
		"academic-session": hasAcademicSession,
		structure: hasStructure,
		students: hasStudents,
		done: false,
	};

	/**
	 * Always resume at the first incomplete step.
	 *
	 * Because this is derived from real backend data, refreshing
	 * the page won't lose the admin's onboarding position.
	 */
	const firstIncomplete = STEP_ORDER.find(
		(key) => !completed[key],
	);

	const currentStep =
		firstIncomplete ?? "done";

	const currentStepNumber = firstIncomplete
		? STEP_ORDER.indexOf(firstIncomplete) + 1
		: STEP_ORDER.length;

	return {
		currentStep,
		currentStepNumber,
		totalSteps: STEP_ORDER.length,
		isComplete: !firstIncomplete,
		isLoading,
		completed,
	};
}
