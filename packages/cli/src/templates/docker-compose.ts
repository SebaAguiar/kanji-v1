import { DatabaseType } from '../types.js';

export function getDockerComposeTemplate(dbType: DatabaseType): string {
  if (dbType === 'postgres') {
    return `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: kanji-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kanji_db
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
`;
  }

  if (dbType === 'mongodb') {
    return `version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: kanji-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    ports:
      - '27017:27017'
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  mongodb_data:
`;
  }

  return '';
}
