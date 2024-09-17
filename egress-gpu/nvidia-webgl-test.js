const puppeteer = require('puppeteer');

(async () => {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-unsafe-webgpu'],
	});
	const page = await browser.newPage();

	// Navigate to the page
	await page.goto('chrome://gpu');

	// Scroll to the bottom of the page to ensure all content is loaded
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

	// Wait a bit more for any lazy-loaded content
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Set viewport to a larger size to capture more content
	await page.setViewport({ width: 1920, height: 5000 });

	// Take the screenshot
	await page.screenshot({ path: 'output.png', fullPage: true });

	// Check WebGL support and performance
	const webGLInfo = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

		if (!gl) {
			return { supported: false, error: 'WebGL not supported' };
		}

		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';

		// Run a simple WebGL performance test
		const startTime = performance.now();
		const iterations = 10000;

		for (let i = 0; i < iterations; i++) {
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		const endTime = performance.now();
		const performanceScore = iterations / (endTime - startTime);

		return {
			supported: true,
			renderer: renderer,
			performanceScore: performanceScore,
			extensions: gl.getSupportedExtensions()
		};
	});

	console.log('WebGL Information:', webGLInfo);

	await browser.close();
})();