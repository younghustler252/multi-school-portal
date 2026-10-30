export function formatBytes(bytes: number, decimals = 1): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = bytes / Math.pow(k, i);

	return `${parseFloat(value.toFixed(decimals))} ${sizes[i]}`;
}
