// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://kanjijs.dev',
	integrations: [
		starlight({
			title: 'Kanji Framework',
			// Logo is rendered via title text — add logo later if needed
			// logo: {
			// 	src: './src/assets/logo.svg',
			// 	alt: 'Kanji Framework',
			// 	replacesTitle: true,
			// },
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/SebaAguiar/kanji-v1' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					translations: { es: 'Primeros Pasos' },
					items: [
						{ label: 'Installation', slug: 'getting-started/installation', translations: { es: 'Instalación' } },
						{ label: 'Quick Start', slug: 'getting-started/quickstart', translations: { es: 'Inicio Rápido' } },
						{ label: 'Project Structure', slug: 'getting-started/project-structure', translations: { es: 'Estructura del Proyecto' } },
					],
				},
				{
					label: 'Core Concepts',
					translations: { es: 'Conceptos Principales' },
					items: [
						{ label: 'Architecture', slug: 'core-concepts/architecture', translations: { es: 'Arquitectura' } },
						{ label: 'Module System', slug: 'core-concepts/modules', translations: { es: 'Sistema de Módulos' } },
						{ label: 'Dependency Injection', slug: 'core-concepts/dependency-injection', translations: { es: 'Inyección de Dependencias' } },
						{ label: 'Contracts', slug: 'core-concepts/contracts', translations: { es: 'Contratos' } },
					],
				},
				{
					label: 'Guides',
					translations: { es: 'Guías' },
					items: [
						{ label: 'Authentication', slug: 'guides/authentication', translations: { es: 'Autenticación' } },
						{ label: 'Database', slug: 'guides/database', translations: { es: 'Base de Datos' } },
						{ label: 'WebSockets', slug: 'guides/websockets', translations: { es: 'WebSockets' } },
						{ label: 'Testing', slug: 'guides/testing', translations: { es: 'Testing' } },
						{ label: 'Security', slug: 'guides/security', translations: { es: 'Seguridad' } },
						{ label: 'OpenAPI & SDK', slug: 'guides/openapi-sdk', translations: { es: 'OpenAPI & SDK' } },
					],
				},
				{
					label: 'CLI',
					translations: { es: 'CLI' },
					items: [
						{ label: 'Overview', slug: 'cli/overview', translations: { es: 'Descripción General' } },
						{ label: 'Commands', slug: 'cli/commands', translations: { es: 'Comandos' } },
					],
				},
				{
					label: 'API Reference',
					items: [{ autogenerate: { directory: 'api-reference' } }],
				},
				{
					label: 'Examples',
					items: [{ autogenerate: { directory: 'examples' } }],
				},
			],
			locales: {
				root: { label: 'English', lang: 'en' },
				es: { label: 'Español', lang: 'es' },
			},
			defaultLocale: 'root',
			lastUpdated: true,
			editLink: {
				base: 'https://github.com/your-org/kanji-v1/edit/main/kanji-docs/',
			},
			pagefind: true,
			customCss: [],
			components: {
				MobileMenuToggle: './src/components/starlight/MobileMenuToggle.astro',
			},
		}),
	],
});
