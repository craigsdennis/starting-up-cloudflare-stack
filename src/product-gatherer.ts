/// <reference lib="dom" />

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import puppeteer from '@cloudflare/puppeteer';

type Link = {
	title: string;
	href: string;
	slug: string;
};

export class ProductGathererWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const browser = await puppeteer.launch(this.env.BROWSER);
		let links = await step.do('Gather Product Links', async () => {
			const page = await browser.newPage();
			await page.goto(`https://developers.cloudflare.com/products/?product-group=Developer+platform`);
			const handles = await page.$$('a.block');
			const links: Array<Link> = [];
			for (const handle of handles) {
				if (!(await handle.isVisible())) {
					continue;
				}
				const link = await handle.evaluate((el: HTMLAnchorElement) => {
					const span = el.querySelector("span.text-md") as HTMLSpanElement;
					const title = span.textContent?.trim() as string;
					return {
						title,
						slug: title.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-'),
						href: el.href as string,
					};
				});
				links.push(link);
			}
			await page.close();
			return links;
		});
		console.log("links", JSON.stringify(links));
		links = await step.do('Filter out already gathered products', async () => {
			const { results } = await this.env.DB.prepare(
				`
					SELECT slug from flash_cards;
				`
			).all();
			const existing = results.map((r) => r.slug);
			return links.filter((l) => !existing.includes(l.slug));
		});
		for (const link of links) {
			const { slogan, svgHTML } = await step.do(`Gather ${link.title}`, async () => {
				const page = await browser.newPage();
				await page.goto(link.href);
				// First one in there
				const sloganHandle = await page.$('.sl-markdown-content p');
				const slogan = await sloganHandle?.evaluate((el) => el.textContent?.trim());
				const svgHandle = await page.$('.sidebar-pane svg');
				const svgHTML = await svgHandle?.evaluate((el) => el.outerHTML);
				await page.close();
				return { slogan, svgHTML };
			});
			const inserted = await step.do(`Storing ${link.title} in database`, async () => {
				let slug = link.slug;
				console.log(`Inserting ${slug}: ${link.title}`);
				const result = await this.env.DB.prepare(`INSERT INTO flash_cards (slug, title, description, url) VALUES (?, ?, ?, ?);`)
					.bind(slug, link.title, slogan, link.href)
					.run();
				return true;
			});
			const stored = await step.do(`Storing SVG for ${link.title}`, async () => {
				const response = await this.env.SVG.put(link.slug, svgHTML as string);
				return response;
			});
			const embeddings = await step.do(`Creating embeddings for ${link.title}`, async() => {
				const results = await this.env.AI.run("@cf/baai/bge-large-en-v1.5", {
					text: slogan as string
				});
				return results.data[0];
			});
			const indexed = await step.do(`Indexing ${link.title}`, async() => {
				const results = await this.env.VECTORIZE.upsert([
					{
						id: link.slug,
						values: embeddings,
						metadata: {
							text: slogan as string,
							url: link.href
						}
					}
				]);
				return results;
			});
		}
	}
}
