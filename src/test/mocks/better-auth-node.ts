export function toNodeHandler() {
  return (_req: any, res: any) => {
    res.status(204).end();
  };
}

export function fromNodeHeaders(headers: any) {
  return headers;
}
