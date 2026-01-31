import { ChangeEvent, MouseEvent, ReactNode } from 'react';

interface ButtonProps {
  children?: ReactNode;
  onChange: (level: number) => void;
  className?: string;
}
const LoadBtn = ({ children, onChange, className = '' }: ButtonProps) => {
  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const blob = new Blob([files[0]]);
    const text = await blob.text();
    onChange(JSON.parse(text));
  };
  const handleOver = (e: MouseEvent<HTMLLabelElement>) => {
    const target = e.currentTarget;
    if (target) target.focus();
  };
  return (
    <label
      className={`inline-flex cursor-pointer justify-center rounded-sm border bg-black p-3 py-1 hover:animate-pulse focus:animate-pulse ${className}`}
      style={{ animationDuration: '500ms' }}
      onMouseOver={handleOver}
      tabIndex={0}
    >
      <span>{children}</span>
      <input className="hidden" type="file" onChange={handleChange} />
    </label>
  );
};

export default LoadBtn;
