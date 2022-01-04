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
// type Prompt = (Sentence[] | Charactor | Choice)[];
// interface Prompt {
//   charactor: Charactor;
//   sentence: (Sentence | Choice)[];
// }
interface Prompt {
  charactor: Charactor;
  sentence: (number | string)[];
}
// interface Prompt {
//   sentence: Sentence[];
//   charactor: Charactor;
//   choice?: Choice;
// }
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

class Game {
  scene: Scene[];
  constructor(scene: Scene[]) {
    this.scene = scene;
  }
}
