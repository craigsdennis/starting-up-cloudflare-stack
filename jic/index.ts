import { Hono } from 'hono';
import { ProductGathererWorkflow } from './product-gatherer';

export { ProductGathererWorkflow };

const app = new Hono<{ Bindings: Env }>();

app.get('/api/cards', async (c) => {
	const { results } = await c.env.DB.prepare(`SELECT * FROM flash_cards ORDER BY title`).all();
	return c.json(results);
});

app.get('api/cards/search', async (c) => {
	const query = c.req.query('q');
	// Encode query
	// @ts-ignore
	const embeddings = await c.env.AI.run('@cf/baai/bge-large-en-v1.5', {
		text: query,
	});
	const results = await c.env.VECTORIZE.query(embeddings.data[0], { returnMetadata: true });
	// Search by similarity
	return c.json({ results });
});

app.get('/api/cards/:slug/svg', async (c) => {
	const slug = c.req.param('slug');
	const result = await c.env.SVG.get(slug);
	return c.json({ result });
});

export default app;