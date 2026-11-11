FROM composer:2 AS dependencias
WORKDIR /app
COPY servico-fiscal/composer.json servico-fiscal/composer.lock ./
# A imagem Composer não traz SOAP; a imagem final instala a extensão antes de executar o serviço.
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-req=ext-gd --ignore-platform-req=ext-soap

FROM php:8.3-cli-alpine
RUN apk add --no-cache freetype-dev libjpeg-turbo-dev libpng-dev libxml2-dev libzip-dev oniguruma-dev $PHPIZE_DEPS \
  && docker-php-ext-configure gd --with-freetype --with-jpeg \
  && docker-php-ext-install dom gd mbstring soap zip \
  && apk del $PHPIZE_DEPS \
  && sed -i 's/^# activate = 1$/activate = 1/' /etc/ssl/openssl.cnf \
  && sed -i '/^default = default_sect$/a legacy = legacy_sect' /etc/ssl/openssl.cnf \
  && printf '\n[legacy_sect]\nactivate = 1\n' >> /etc/ssl/openssl.cnf
WORKDIR /app
COPY --from=dependencias /app/vendor ./vendor
COPY servico-fiscal/src ./src
COPY servico-fiscal/tests ./tests
EXPOSE 8081
CMD ["php", "-S", "0.0.0.0:8081", "src/index.php"]
