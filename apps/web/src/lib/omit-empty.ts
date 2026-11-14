/**
 * Drops the keys of a submitted form that are blank ("") or undefined, so optional fields are not sent as empty strings.
 * Typed as the input type: required fields were already checked by the form's schema before this runs, and a blank
 * required field would have failed there, so only optional keys can disappear.
 */
export function omitEmpty<T extends object>(values: T): T {
	return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)) as T;
}
