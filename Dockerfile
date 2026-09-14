FROM node:24-bookworm-slim
ENV NODE_ENV=production DUEL_HOST=0.0.0.0 DUEL_PORT=4173 DUEL_DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org && npm cache clean --force
COPY src/ ./src/
COPY server/ ./server/
COPY index.html ./index.html
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
