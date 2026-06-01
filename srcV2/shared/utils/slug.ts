import slugify from "slugify";

/**
 * Generate a URL-friendly slug from a school name
 * e.g., "Green Side Academy" -> "green-side-academy"
 */
export const generateSlug = (name: string): string => {
    return slugify(name, {
        lower: true,
        strict: true,   // remove special chars
        locale: "en"
    });
};

/**
 * Ensure the slug is unique in the DB by appending a number if needed
 */
export const generateUniqueSlug = async (name: string, checkSlugExists: (slug: string) => Promise<boolean>): Promise<string> => {
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let i = 1;

    while (await checkSlugExists(slug)) {
        slug = `${baseSlug}-${i}`;
        i++;
    }

    return slug;
};
