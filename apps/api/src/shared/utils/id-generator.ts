export async function generateAdmissionNumber(
    format: string,
    getNextSequence: () => Promise<number>,
): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await getNextSequence();

    return format
        .replace("{YEAR}", String(year))
        .replace("{NUMBER}", String(sequence).padStart(4, "0"));
}