import { Types } from "mongoose";

/**
 * Convert a Mongoose ObjectId (or null/undefined) to string
 * Returns undefined if the input is null or invalid
 */
export const objectIdToString = (id: Types.ObjectId | string | null | undefined): string | undefined => {
	if (!id) return undefined;
	if (id instanceof Types.ObjectId) return id.toHexString();
	return id.toString();
};

/**
 * Convert an array of ObjectIds to strings
 */
export const objectIdsToStrings = (ids: (Types.ObjectId | string)[]): string[] => {
	return ids.map(id => id instanceof Types.ObjectId ? id.toHexString() : id.toString());
};


export const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
	id instanceof Types.ObjectId ? id : new Types.ObjectId(id);