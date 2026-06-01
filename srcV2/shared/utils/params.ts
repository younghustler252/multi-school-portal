export const getParamAsString = (param: string | string[]): string => {
    return Array.isArray(param) ? param[0] : param;
};
