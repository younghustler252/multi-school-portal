import swaggerJsdoc from "swagger-jsdoc";
import { env } from "../../config/env";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title:       "SchoolPortal API",
            version:     "1.0.0",
            description: "Multi-tenant school management platform API",
        },
        servers: [
            { url: `http://localhost:${env.PORT}/api/v1`, description: "Local" },
        ],
        components: {
            securitySchemes: {
                cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken" },
                bearerAuth: { type: "http", scheme: "bearer" },
            },
        },
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
    },
    apis: ["./src/modules/**/routes/*.routes.ts"], // scans JSDoc comments in every route file
};

export const swaggerSpec = swaggerJsdoc(options);