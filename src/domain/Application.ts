import { Connection } from './Connection'
import { Tab } from './Tab'

export default class Application {
  constructor(
    public connections: Connection[] = [],
    public tabs: Tab[] = []
    private metaDatabase =
  ) {}

  private initialize(): Promise<boolean> {

    return new Promise(() => {})
  }
}
