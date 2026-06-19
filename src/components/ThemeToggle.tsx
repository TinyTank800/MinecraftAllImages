"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("dark");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const current = (document.documentElement.dataset.theme as Theme) || "dark";
		setTheme(current);
		setMounted(true);
	}, []);

	const toggle = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		setTheme(next);
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem("theme", next);
		} catch {}
	};

	const isDark = theme === "dark";

	return (
		<button
			type="button"
			className="theme-toggle"
			onClick={toggle}
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			title={`Switch to ${isDark ? "light" : "dark"} mode`}
		>
			<span aria-hidden="true">{mounted ? (isDark ? "☀️" : "🌙") : "☀️"}</span>
		</button>
	);
}
