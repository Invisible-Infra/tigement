import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

const router = Router();

// Load OpenAPI spec
const specPath = path.join(__dirname, '../../..', 'docs', 'openapi.yaml');

let swaggerDocument: any;

try {
  if (fs.existsSync(specPath)) {
    swaggerDocument = YAML.load(specPath);
    console.log('✓ Loaded OpenAPI specification from:', specPath);
  } else {
    console.warn('⚠️  OpenAPI spec not found at:', specPath);
    swaggerDocument = {
      openapi: '3.0.0',
      info: {
        title: 'Tigement API',
        version: '1.0.0',
        description: 'API documentation not available. OpenAPI spec file not found.'
      },
      paths: {}
    };
  }
} catch (error) {
  console.error('❌ Failed to load OpenAPI spec:', error);
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'Tigement API',
      version: '1.0.0',
      description: 'Error loading API documentation.'
    },
    paths: {}
  };
}

// Swagger UI options
const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Tigement API Documentation',
};

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDocument, options));

export default router;
