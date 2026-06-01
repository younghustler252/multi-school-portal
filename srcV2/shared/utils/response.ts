import { Response } from "express";

export type HttpStatusCode =
| 200 | 201 | 202 | 204
| 400 | 401 | 403 | 404 | 409 | 422
| 500 | 502 | 503;


type SuccessResponse<T> = Readonly<{
    success: true;
    statusCode: HttpStatusCode;
    message: string;
    data: T;
}>;
    

type ErrorResponse<E = unknown> = Readonly<{
    success: false;
    statusCode: HttpStatusCode;
    message: string;
    error?: E;
}>;
    

export const sendSuccess = <T>(
    res: Response,
    data: T,
    statusCode: HttpStatusCode = 200,
    message = "Request successful"
) => {
    const response: SuccessResponse<T> = {
        success: true,
        statusCode,
        message,
        data,
    };
    
    return res.status(statusCode).json(response);
};

export const sendError = <E = unknown>(
    res: Response,
    statusCode: HttpStatusCode = 500,
    message = "An error occurred",
    error?: E
) => {
    const response: ErrorResponse<E> = {
        success: false,
        statusCode,
        message,
        ...(error && { error }),
    };

    return res.status(statusCode).json(response);

};
