"use client";

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Header } from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('App error:', error, info.componentStack);
	}

	handleRetry = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (!this.state.hasError) {
			return this.props.children;
		}

		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="container flex-1 py-16 pb-24">
					<div className="card p-8 md:p-10 max-w-xl mx-auto text-center">
						<p className="text-6xl font-bold gradient-text mb-4" aria-hidden="true">
							!
						</p>
						<h1 className="gradient-text text-2xl md:text-3xl font-bold mb-3">Something went wrong</h1>
						<p className="hero-lead mb-6">
							This page hit an unexpected error and could not finish loading. You can try again or
							head back to the gallery.
						</p>
						{import.meta.env.DEV && this.state.error && (
							<pre
								className="text-left text-xs mb-6 p-4 rounded-lg overflow-x-auto"
								style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
							>
								{this.state.error.message}
							</pre>
						)}
						<div className="flex flex-wrap gap-3 justify-center">
							<button type="button" className="btn btn-primary" onClick={this.handleRetry}>
								Try again
							</button>
							<a href="/" className="btn btn-ghost">
								Back to gallery
							</a>
						</div>
					</div>
				</main>
				<SiteFooter />
			</div>
		);
	}
}
