import { CSSProperties, ReactNode, createContext, useContext, useState } from 'react';
interface UiProviderProps {
  children?: ReactNode;
}
interface ContextProps {
  style: CSSProperties;
  setStyle: (color: string) => void;
}
const UiContext = createContext<ContextProps>({
  style: {},
  setStyle: () => {},
});
export const UiProvider = ({ children }: UiProviderProps) => {
  const [style, setStyle] = useState({});
  return <UiContext.Provider value={{ style, setStyle }}>{children}</UiContext.Provider>;
};
export const useUiContext = () => useContext(UiContext);
