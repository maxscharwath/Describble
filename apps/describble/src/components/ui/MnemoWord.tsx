import React from 'react';
import {useTranslation} from 'react-i18next';

export const MnemonicWord = React.forwardRef(({label, hidden, ...props}: React.InputHTMLAttributes<HTMLInputElement> & {label: number}, ref: React.ForwardedRef<HTMLInputElement>) => {
	const {t} = useTranslation();
	return (
		<label className='join flex flex-row items-center ring ring-base-300'>
			<div
				className='join-item flex h-full w-10 items-center justify-center bg-base-300 font-mono text-xs font-bold'>
				#{label}
			</div>
			<input
				ref={ref}
				className='input join-item input-md w-full truncate font-mono text-xs sm:text-base'
				type={hidden ? 'password' : 'text'}
				placeholder={t('input.placeholder.enter_word')}
				tabIndex={props.readOnly ? -1 : 0}
				{...props} />
		</label>
	);
});

MnemonicWord.displayName = 'MnemonicWord';
