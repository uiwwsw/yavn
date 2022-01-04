interface Choice {
  question: Sentence;
  answer: string[];
}
interface Charactor {
  name: string;
  images: {
    [Key: string]: string;
  };
}
interface Sentence {
  word: string;
  wait?: number;
  duration?: number;
  audio?: string;
}
interface Prompt {
  sentence: Sentence[];
  charactor: Charactor;
  choice?: Choice;
}
interface Background {
  image?: string;
  position?: string;
  color?: string;
}
interface Scene {
  prompt: Prompt[];
  background: Background;
}
interface Game {
  scene: Scene[];
}
