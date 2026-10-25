import { productCapabilities } from '../lib/product-capabilities';
export function GET() {
  return new Response(JSON.stringify(productCapabilities(), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
