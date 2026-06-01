export const normalizeDomain = (domain: string): string => {
    if (!domain) return '';
    return domain.trim().toLowerCase();
};

export const validateDomain = (domain: string): boolean => {
    // simple regex for hostname validation
    const regex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z]{2,})+$/;
    return regex.test(domain);
};
