import Btn from '@/Btn';
import { useStorageContext } from '@/useStorageContext';
import { motion } from 'framer-motion';

const CreditPage = () => {
  const { addStorage } = useStorageContext();
  const handleClick = () => addStorage({ page: 'startMenu' });

  const credits = [
    { role: 'Developer', name: 'uiwwsw' },
    { role: 'Story & Narrative', name: 'matthew' },
    { role: 'Special Thanks', name: '윤창원' },
  ];

  return (
    <motion.div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-12 p-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-[0.2em] text-white">ENDING</h1>
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>

        <ul className="w-full space-y-6">
          {credits.map((item, index) => (
            <motion.li
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 + 0.3 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-xs uppercase tracking-widest text-emerald-400/80">{item.role}</span>
              <span className="text-lg font-light text-slate-100">{item.name}</span>
            </motion.li>
          ))}
        </ul>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-4"
        >
          <Btn onClick={handleClick} className="min-w-[200px] border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10">
            처음부터 시작하기
          </Btn>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60" />
    </motion.div>
  );
};

export default CreditPage;
