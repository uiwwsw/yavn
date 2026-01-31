import Btn from '@/Btn';
import { useStorageContext } from '@/useStorageContext';
import { motion } from 'framer-motion';

const ToBeContinuedPage = () => {
    const { addStorage } = useStorageContext();
    const handleExit = () => addStorage({ page: 'startMenu', level: 0 });

    return (
        <motion.div
            className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80" />

            <div className="relative z-10 flex max-w-lg flex-col items-center gap-8 p-8 text-center">
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-widest text-emerald-400">
                        TO BE CONTINUED
                    </h1>
                    <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                </div>

                <div className="space-y-2 text-slate-300">
                    <p className="text-lg">다음 챕터가 없을때 아직 작업중입니다. </p>
                    <p className="text-sm opacity-60">잠시 기다려주세요</p>
                </div>

                <div className="mt-8">
                    <Btn onClick={handleExit} className="min-w-[200px]">
                        타이틀로 돌아가기
                    </Btn>
                </div>
            </div>
        </motion.div>
    );
};

export default ToBeContinuedPage;
