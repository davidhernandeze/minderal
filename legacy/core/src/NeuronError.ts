export class NeuronError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeuronError'
  }
}
