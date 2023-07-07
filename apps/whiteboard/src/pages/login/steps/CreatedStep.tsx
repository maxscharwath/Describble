import React from 'react';
import {useSteps} from '~pages/login/useSteps';
import {type RegisterContext} from '~pages/login/RegisterContent';
import {useTranslation} from 'react-i18next';
import Avatar from 'boring-avatars';
import {CopyIcon} from 'ui/components/Icons';

export const CreatedStep: React.FC = () => {
	const {t} = useTranslation();
	const {state: {session}} = useSteps<RegisterContext>();

	if (!session) {
		return null;
	}

	return (
		<>
			<div className='px-0 sm:px-8'>
				<div className='flex flex-col items-center'>
					<div className='avatar'>
						<div className='w-24 rounded-full shadow-lg ring ring-neutral ring-offset-2 ring-offset-base-100'>
							<Avatar
								size='100%'
								square
								name={session.base58PublicKey}
								variant='beam'
								colors={['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90']}
							/>
						</div>
					</div>
					<h1 className='mt-4 text-center text-2xl font-bold'>{t('register.title_created')}</h1>
					<p className='mt-2 text-center text-base-content text-opacity-80'>{t('register.subtitle_created')}</p>
					<div className='join mt-4'>
						<button className='btn-neutral join-item btn'><CopyIcon/></button>
						<input type='text' readOnly className='input-bordered input join-item text-ellipsis text-xs' value={session.base58PublicKey} />
					</div>
				</div>
				<div className='mt-6 flex gap-4'>
					<button className='btn-neutral btn grow'>{t('btn.login')}</button>
				</div>
			</div>
		</>
	);
};