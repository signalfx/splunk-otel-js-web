import { SESSION_INACTIVITY_TIMEOUT_SECONDS } from "../session/constants";
import { isIframe } from "../utils";
import { throttle } from "../utils/throttle";

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

export class CookieStore<T> implements Store<T> {
	private _cachedValue: T | undefined;

	private _throttledSetRaw = throttle((value: string) => {
		document.cookie = value
	}, 1000);

	constructor(
		private key: string,
	) {}

	set(value: T, domain?: string) {
		this._cachedValue = value
		this._throttledSetRaw(this._serialize(value, domain))
	}

	flush() {
		this._throttledSetRaw.flush()
	}

	get({ forceDiskRead = false }: { forceDiskRead?: boolean } = {}): T | undefined {
		if (this._cachedValue === null || forceDiskRead) {
			this._cachedValue = this._deserialize(this._getRaw(this.key));
			return this._cachedValue;
		}

		return this._cachedValue;
	}

	remove(domain?: string) {
		const domainPart = domain ? `domain=${domain};` : ''
		const cookie = `${this.key}=;${domainPart}path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`

		this._throttledSetRaw(cookie);
		this.flush();
	}

	protected _serialize(value: T, domain?: string): string {

		const cookieValue = encodeURIComponent(JSON.stringify(value));
		const domainPart = domain ? `domain=${domain};` : ''

		let rawCookie = `${this.key}=${cookieValue};path=/;${domainPart};max-age=${SESSION_INACTIVITY_TIMEOUT_SECONDS}`;

		if (isIframe()) {
			// Safari does not set cookie when the SameSite attribute is set to None and Secure is set to true in an iframe
			// It fails also in our unit tests since they are running in iframe and on localhost.
			if (['localhost', '127.0.0.1'].includes(window.location.hostname) && isSafari) {
				rawCookie += ';SameSite=None'
			} else {
				rawCookie += ';SameSite=None; Secure'
			}
		} else {
			rawCookie += ';SameSite=Strict'
		}

		return rawCookie;
	}

	protected _deserialize(rawValue: string): T | undefined {
		if (!rawValue) {
			return undefined;
		}

		let value: T;
		try {
			value = JSON.parse(rawValue) as T; // TODO: type T verification?
		} catch {
			return undefined;
		}

		return value;
	}

	protected _getRaw(
		cookieName: string,
	): string | undefined {
		const cookies = document.cookie.split(';');
		for (let i = 0; i < cookies.length; i++) {
			const c = cookies[i].trim();
			if (c.indexOf(cookieName + '=') === 0) {
				return decodeURIComponent(c.substring((cookieName + '=').length, c.length));
			}
		}
		return undefined;
	}
}
