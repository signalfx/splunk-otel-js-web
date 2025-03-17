import { PersistenceType } from "../types";
import { CookieStore } from "./cookie-store";
import { LocalStore } from "./local-store";

export interface Store<T> {
	set: (value: T, domain?: string) => void;
	flush: () => void;
	get: ({ forceDiskRead }: { forceDiskRead?: boolean }) => T;
	remove: (domain?: string) => void;
}

export function buildStore<T>(config: { type: PersistenceType, key: string }): Store<T> {
	if (config.type == 'localStorage') {
		return new LocalStore(config.key)
	}

	if (config.type == 'cookie') {
		return new CookieStore(config.key)
	}

	throw new Error('Unknown store type')
}
