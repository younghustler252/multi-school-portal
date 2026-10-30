import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'School Portal API',
      version: '1.0.0',
      description: 'Multi-tenant school management API',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./modules/**/routes/*.ts'], // points to your route files
};

export const swaggerSpec = swaggerJsdoc(options);