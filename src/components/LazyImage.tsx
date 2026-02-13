import { HTMLMotionProps, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface LazyImageProps extends HTMLMotionProps<'img'> {
    src: string;
    placeholder?: string;
    threshold?: number;
}

const LazyImage = ({ src, placeholder, threshold = 0.1, className, alt, ...props }: LazyImageProps) => {
    const [loaded, setLoaded] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [threshold]);

    return (
        <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
            {isVisible && (
                <motion.img
                    src={src}
                    alt={alt}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: loaded ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                    onLoad={() => setLoaded(true)}
                    className={`h-full w-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    {...props}
                />
            )}
            {!loaded && placeholder && (
                <img
                    src={placeholder}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover blur-lg"
                />
            )}
            {!loaded && !placeholder && (
                <div className="absolute inset-0 animate-pulse bg-gray-700/50" />
            )}
        </div>
    );
};

export default LazyImage;
