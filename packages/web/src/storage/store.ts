interface Store<T> {
	set: (value: T, domain?: string) => void;
	flush: () => void;
	get: ({ forceDiskRead }: { forceDiskRead?: boolean }) => T;
	remove: (domain?: string) => void;
}
