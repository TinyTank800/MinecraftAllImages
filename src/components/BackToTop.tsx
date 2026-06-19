"use client";

import React, { useEffect, useState } from 'react';

export function BackToTop(props: { containerId: string }) {
	const { containerId } = props;
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = document.getElementById(containerId);
		if (!el) return;
		const onScroll = () => setVisible(el.scrollTop > 400);
		el.addEventListener('scroll', onScroll);
		return () => el.removeEventListener('scroll', onScroll);
	}, [containerId]);

	return (
		<button
			type="button"
			aria-label="Back to top of gallery"
			className={`btn btn-primary sticky bottom-3 w-full transition ${visible ? 'opacity-95 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}
			onClick={() => {
				const el = document.getElementById(containerId);
				el?.scrollTo({ top: 0, behavior: 'smooth' });
			}}
		>
			Back to Top
		</button>
	);
}


