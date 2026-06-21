"use client";

import { ThemeToggle } from './ThemeToggle';
import { LatestUpdateBadge } from './LatestUpdateBadge';

export function Header() {
	return (
		<header className="site-header">
			<div className="container inner">
				<div className="brand-block">
					<a className="brand" href="/" aria-label="Minecraft Item Gallery home">
						<img src="/assets/logo.svg" alt="" width={40} height={40} />
						<span className="brand-name">Minecraft Item Gallery</span>
					</a>
					<LatestUpdateBadge />
				</div>

				<nav className="header-actions" aria-label="Site navigation">
					<a href="/" className="btn btn-ghost text-sm py-1 px-2 header-nav-link">
						Items
					</a>
					<a href="/particles" className="btn btn-ghost text-sm py-1 px-2 header-nav-link">
						Particles
					</a>
					<a href="/removed" className="btn btn-ghost text-sm py-1 px-2 header-nav-link">
						Removed
					</a>
					<a href="/docs" className="btn btn-ghost text-sm py-1 px-2 header-nav-link">
						Docs
					</a>
					<ThemeToggle />
					<a
						className="btn btn-primary"
						href="https://discord.oksqd.com"
						target="_blank"
						rel="noopener noreferrer"
					>
						Discord
					</a>
				</nav>
			</div>
		</header>
	);
}
