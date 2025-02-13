import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	webpack: (config, options) => {
		if (options.dev) {
			// Do not instrument code in development
			return config
		}

		if (options.isServer) {
			// Do not instrument server code
			return config
		}

		const previousEntryFunction = config.entry

		config.entry = async () => {
			const newEntries = await previousEntryFunction()
			for (const [key, value] of Object.entries(newEntries)) {
				if (!['main-app', 'pages/_app'].includes(key)) {
					continue
				}

				if (!Array.isArray(value)) {
					continue
				}

				newEntries[key] = ['./instrumentation.client.ts', ...value]
			}

			return newEntries
		}

		return config
	},
}

export default nextConfig
