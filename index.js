import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { engine } from 'express-handlebars';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const CLAVE_SECRETA = process.env.CLAVE_SECRETA || 'sedavueltaelsemestre123';
const AUTH_COOKIE_NAME = 'segurida';
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:AjB5lLp9bsFc@ep-bitter-mud-a5hggoue.us-east-2.aws.neon.tech/neondb?sslmode=require');

import session from 'express-session';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public'))); // Asegúrate de que esta carpeta exista

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

//---------------------------------------------------------------------------registro y autenticacion = funcional
const authMiddleware = async (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];

  try {
    req.user = jwt.verify(token, CLAVE_SECRETA);
    const results = await sql('SELECT * FROM usuarios WHERE id = $1', [
      req.user.id,
    ]);
    req.user = results[0];
    req.user.salutation = `Hola ${req.user.name}`;
    next();
  } catch (e) 
  {
    res.render('login');
  }
};

//---------------------------------------------------------------------------registro = funcional
app.use(session({
  secret: 'tu_secreto_para_firmar_las_sesiones',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true } 
}));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

app.post("/usuarios", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const queryCheck = "SELECT * FROM usuarios WHERE email = $1";
  const result = await sql(queryCheck, [email]);
  if (result.length > 0) 
  {
    res.render("registrarse", { error: "El nombre de email ya está en uso." });
  } 
  else {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const query = "INSERT INTO usuarios (rango, email, password, dinero, link_imagen_perfil) VALUES ($1, $2, $3, $4, $5)";
    await sql(query, [1, email, hashedPassword, 50000, "https://i.imgur.com/a0KpXH3.jpeg"]);

    res.redirect("login");
  }
});

//---------------------------------------------------------------------------homes = funcional
app.get('/', async (req, res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM productodef");
  res.render("home", {lista, lista2});
});

app.get("/home", async (req,res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM productodef");
  res.render("home", {lista, lista2});
});

app.get("/homeuser", async (req,res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM productodef");
  res.render("homeuser", {lista, lista2});
});

app.get("/homeADMIN",authMiddleware, async (req,res) => {
 const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM productodef");
  const resultado = await sql("SELECT SUM(total) AS total FROM voleta");
  const total = resultado[0].total;
  res.render("homeADMIN", {lista, lista2, total});
});



//---------------------------------------------------------------------------direccionadores = funcional
app.get("/direccionador",authMiddleware, async (req,res) => {
   const user = req.user;
   res.render("direccionador", user);
 });
 app.get("/direccionadorr",authMiddleware, async (req,res) => {
  const user = req.user;
  res.render("direccionadorr", user);
});
 
//---------------------------------------------------------------------------wallet = funcional
app.get('/wallet', authMiddleware, async (req, res) => {
  const user = req.user;
  const userId = user.id;
  const lista = await sql("SELECT * FROM voleta WHERE id_asignado = $1", [userId]);
    res.render('wallet', {user,lista});
});



//---------------------------------------------------------------------------pantalla sesion = funcional
app.get('/sesionuser', authMiddleware, async (req, res) => {
  const user = req.user;
    res.render('sesionuser', user);
});





//---------------------------------------------------------------------------cambiar foto = funcional
app.get('/fotoperfil', authMiddleware, async (req, res) => {
  const user = req.user;
    res.render('fotoperfil', {user});
});

//---------------------------------------------------------------------------pantalla de armas = funcional
app.get("/pantallaarma", authMiddleware, async (req, res) => {
  const user = req.user;
  const id = req.query.paginaid;
  const result = await sql('SELECT * FROM producto WHERE id = $1', [id]);
  const producto = result[0];
  res.render("pantallaarma", {user, producto});
});

app.get("/pantallaobjeto",authMiddleware, async (req, res) => {
  const user = req.user;
  const id = req.query.paginaid;
  const result = await sql('SELECT * FROM productodef WHERE id = $1', [id]);
  const producto = result[0];
  res.render("pantallaobjeto", { user, producto });
});

//---------------------------------------------------------------------------cambiar foto perfil = funcional
app.post('/actualizarfoto', authMiddleware, async (req, res) => {
  const user = req.user;
  const datosActualizados = {
    link_imagen_perfil: req.body.link_imagen_perfil
};


  await actualizarfoto(user.id, datosActualizados);
  res.redirect('/direccionadorr');
});

async function actualizarfoto(id, datos) {
  try {
      await sql(
          `UPDATE usuarios
           SET link_imagen_perfil = $1
           WHERE id = $2`,
           
          [
              datos.link_imagen_perfil,
              id
          ]
      );
  } catch (error) {
      console.error("Error al cambiar foto:", error);
      throw error;
  }
}

//---------------------------------------------------------------------------carrito = funcional
app.get('/carrito', authMiddleware, async (req, res) => {
  const user = req.user;
  const userId = user.id;

  // Obtener todos los productos del carrito del usuario
  const productosEnCarrito = await sql("SELECT * FROM ventaencaja WHERE id_asignado = $1", [userId]);

  // Crear un objeto para agrupar productos por id_asignado e id_producto
  const productosAgrupados = {};
  const duplicados = [];

  // Detectar duplicados y agrupar productos
  for (const producto of productosEnCarrito) {
    const key = `${producto.id_asignado}-${producto.id_producto}`;

    if (productosAgrupados[key]) {
      // Si ya existe un producto con esta clave, lo marcamos como duplicado
      productosAgrupados[key].cantidad_producto += producto.cantidad_producto;
      productosAgrupados[key].total += producto.total;
      duplicados.push(producto.id); // Guardamos el ID para eliminarlo después
    } else {
      // Agregar el producto si es la primera vez que aparece
      productosAgrupados[key] = { ...producto };
    }
  }

  // Eliminar los productos duplicados (excepto el primero de cada grupo)
  if (duplicados.length > 0) {
    await sql(
      `DELETE FROM ventaencaja WHERE id = ANY($1::int[])`, 
      [duplicados]
    );
  }

  // Actualizar los productos agrupados en la base de datos
  for (const key in productosAgrupados) {
    const producto = productosAgrupados[key];
    await sql(
      `UPDATE ventaencaja 
       SET cantidad_producto = $1, total = $2
       WHERE id = $3`,
      [producto.cantidad_producto, producto.total, producto.id]
    );
  }

  // Calcular el total general después de combinar los productos
  const resultado = await sql("SELECT SUM(total) AS totalin FROM ventaencaja WHERE id_asignado = $1", [userId]);
  const totalin = resultado[0]?.totalin || 0; // Manejar el caso donde no haya total

  // Renderizar la vista con los productos agrupados
  res.render("carrito", { user, carrito: Object.values(productosAgrupados), totalin });
});




app.post('/eliminarcaja', async (req, res) => {
  const cajaId = req.body.id;
  try {
    await eliminarcaja(cajaId);
    console.log(`Producto con ID ${cajaId} eliminado con éxito.`); // Mensaje en consola
    res.redirect('/carrito'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});

async function eliminarcaja(id) {
  try {
    await sql(`DELETE FROM ventaencaja WHERE id = $1`, [id]);
    console.log(`Producto con ID ${id} eliminado con éxito. parte 2`); // Mensaje en consola
  } catch (error) {
    console.error("Error la voleta de la base de datos:", error);
    throw error;
  }
}


app.post('/comprar', authMiddleware, async (req, res) => {
  const user = req.user;
  const userId = user.id;

  const productosEnCarrito = await sql("SELECT * FROM ventaencaja WHERE id_asignado = $1", [userId]);

  // Iniciar la transacción
  try {
      await sql.query('BEGIN');

      for (const producto of productosEnCarrito) {
          const { id_producto, cantidad_producto } = producto;

          // Restar la cantidad comprada del stock del producto
          const resultadoProducto = await sql("SELECT cantidad FROM producto WHERE id = $1", [id_producto]);

          if (resultadoProducto.length === 0) {
              throw new Error(`Producto con id ${id_producto} no encontrado`);
          }

          const stockActual = resultadoProducto[0].cantidad;

          if (stockActual < cantidad_producto) {
              throw new Error(`Stock insuficiente para el producto ${id_producto}`);
          }

          const nuevoStock = stockActual - cantidad_producto;

          // Actualizar el stock del producto
          await sql("UPDATE producto SET cantidad = $1 WHERE id = $2", [nuevoStock, id_producto]);
      }

      // Confirmar la transacción
      await sql.query('COMMIT');
      res.send('Compra realizada exitosamente');
  } catch (error) {
      // Revertir la transacción si algo sale mal
      await sql.query('ROLLBACK');
      console.error('Error en la compra:', error.message);
      res.status(500).send('Error al realizar la compra');
  }
});


app.post('/transferir-a-voleta', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const productosCarrito = req.body.productos; // Lista de productos desde el frontend
  const totalin = req.body.totalin;

  try {
      // Iniciar una transacción
      await sql.beginTransaction();

      // Iterar sobre cada producto comprado
      for (const producto of productosCarrito) {
          // Buscar el ID del producto en la tabla ventaencaja para obtener el id_producto
          const productoEnCarrito = await sql(
              "SELECT id_producto, cantidad_producto FROM ventaencaja WHERE nombre_producto = $1 AND id_asignado = $2",
              [producto.nombre, userId]
          );

          if (productoEnCarrito.length > 0) {
              const idProducto = productoEnCarrito[0].id_producto;
              const cantidadComprada = productoEnCarrito[0].cantidad_producto;

              // Actualizar el stock en la tabla producto o productodef (según el caso)
              await sql(
                  `UPDATE producto SET cantidad = cantidad - $1 WHERE id_producto = $2`,
                  [cantidadComprada, idProducto]
              );
              await sql(
                  `UPDATE productodef SET cantidad = cantidad - $1 WHERE id_producto = $2`,
                  [cantidadComprada, idProducto]
              );
          }
      }

      // Finalizar la transacción
      await sql.commitTransaction();

      res.status(200).json({ message: 'Compra realizada y stock actualizado.' });
  } catch (error) {
      await sql.rollbackTransaction();
      console.error("Error en la compra: ", error);
      res.status(500).json({ error: "Hubo un error al procesar la compra." });
  }
});







//---------------------------------------------------------------------------añadir al carrito = en proceso


app.post('/newcarrito', async (req, res) => {
  try {
    const { id_asignado, id_producto, cantidad_producto, precio_producto, imagen_producto, nombre_producto } = req.body;
    const total = cantidad_producto * precio_producto;

    const query = `
      INSERT INTO ventaencaja 
      (id_asignado, id_producto, cantidad_producto, precio_producto, total, imagen_producto, nombre_producto) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await sql(query, [id_asignado, id_producto, cantidad_producto, precio_producto, total, imagen_producto, nombre_producto]);

    res.redirect('/direccionador');
  } catch (error) {
    console.error('Error al añadir al carrito:', error);
    res.status(500).send('Error al procesar la solicitud');
  }
});

//---------------------------------------------------------------------------cerrar sesion = funcional
app.get('/logout', (req, res) => {
  res.cookie(AUTH_COOKIE_NAME, '', { maxAge: 1 });
  res.render('direccionador');
});

//---------------------------------------------------------------------------iniciar sesion = funcional
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const query = 'SELECT id, password FROM usuarios WHERE email = $1';
  const results = await sql(query, [email]);
  if (results.length === 0) {
    res.redirect(302, '/login?error=unauthorized');
    return;
  }

  const id = results[0].id;
  const hash = results[0].password;

  if (bcrypt.compareSync(password, hash)) {
    const fiveMinutesFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
    const token = jwt.sign(
      { id, exp: fiveMinutesFromNowInSeconds },
      CLAVE_SECRETA
    );

    res.cookie(AUTH_COOKIE_NAME, token, { maxAge: 60 * 5 * 1000 });
    res.redirect(302, '/direccionador');
    return;
  }

  res.redirect('/login?error=unauthorized');
});

//---------------------------------------------------------------------------registrar sesion = funcional
app.get('/registrarse', (req, res) => {
  res.render('registrarse');
});

const generarToken = (datos) => jwt.sign(datos, CLAVE_SECRETA, { expiresIn: '1h' });



//---------------------------------------------------------------------------agregar objeto = funcional
app.get("/agregararma", async (req, res) => 
{
  res.render("agregararma");
});
app.get("/agregarobjeto", async (req, res) => 
{
  res.render("agregarobjeto");
});
app.post("/newproduct", async (req, res) => {
  const nombre = req.body.nombre;
  const description = req.body.description;
  const image = req.body.image;
  const image1 = req.body.image1;
  const image2 = req.body.image2;
  const image3 = req.body.image3;
  const video = req.body.video;
  const datof = req.body.datof;
  const datos = req.body.datos;
  const price = req.body.price;
  const quantity = req.body.quantity;
 
    const query = "INSERT INTO producto (nombre, cantidad, precio, link_imagen_principal, link_imagen1, link_imagen2, link_imagen3, link_video, datof, datos, definicion) VALUES ($1, $2, $3, $4,$5,$6, $7, $8, $9, $10, $11)";
    await sql(query, [nombre, quantity, price, image, image1, image2, image3, video, datof, datos, description ]);

    res.redirect("direccionador");
  
});
app.post("/newproduct2", async (req, res) => {
  const nombre = req.body.nombre;
  const description = req.body.description;
  const image = req.body.image;
  const image1 = req.body.image1;
  const image2 = req.body.image2;
  const image3 = req.body.image3;
  const video = req.body.video;
  const datof = req.body.datof;
  const datos = req.body.datos;
  const price = req.body.price;
  const quantity = req.body.quantity;
 
    const query = "INSERT INTO productodef (nombre, cantidad, precio, link_imagen_principal, link_imagen1, link_imagen2, link_imagen3, link_video, datof, datos, definicion) VALUES ($1, $2, $3, $4,$5,$6, $7, $8, $9, $10, $11)";
    await sql(query, [nombre, quantity, price, image, image1, image2, image3, video, datof, datos, description ]);

    res.redirect("direccionador");
  
});

//---------------------------------------------------------------------------editar arma = funcional
async function obtenerArmaPorId(id) {
  try {
      const resultado = await sql(`SELECT * FROM producto WHERE id = $1`, [id]);
      return resultado[0];
  } catch (error) {
      console.error("Error al obtener el arma:", error);
      throw error;
  }
}

app.get('/editararma', async (req, res) => {
  const armaId = req.query.id;
  const arma = await obtenerArmaPorId(armaId);
  res.render('editararma', { arma });
});

app.post('/actualizararma', async (req, res) => {
  const armaId = req.body.id;
  const datosActualizados = {
    nombre: req.body.nombre,
    definicion: req.body.definicion,
    link_imagen_principal: req.body.link_imagen_principal,
    link_imagen1: req.body.link_imagen1,
    link_imagen2: req.body.link_imagen2,
    link_imagen3: req.body.link_imagen3,
    link_video: req.body.link_video,
    datof: req.body.datof,
    datos: req.body.datos,
    precio: req.body.precio,
    cantidad: req.body.cantidad
};


  await actualizarArma(armaId, datosActualizados);
  res.redirect('/homeADMIN');
});


async function actualizarArma(id, datos) {
  try {
      await sql(
          `UPDATE producto
           SET nombre = $1, definicion = $2, link_imagen_principal = $3, link_imagen1 = $4, 
               link_imagen2 = $5, link_imagen3 = $6, link_video = $7, datof = $8, 
               datos = $9, precio = $10, cantidad = $11
                WHERE id = $12`,
          [
              datos.nombre,
              datos.definicion,
              datos.link_imagen_principal,
              datos.link_imagen1,
              datos.link_imagen2,
              datos.link_imagen3,
              datos.video,
              datos.datof,
              datos.datos,
              datos.precio,
              datos.cantidad,
              id
          ]
      );
  } catch (error) {
      console.error("Error al actualizar el arma:", error);
      throw error;
  }
}
//---------------------------------------------------------------------------eliminar arma = funcional
app.post('/eliminararma', async (req, res) => {
  const armaId = req.body.id;
  try {
    await eliminarArma(armaId); 
    res.redirect('/homeADMIN'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});

async function eliminarArma(id) {
  try {
    await sql(`DELETE FROM producto WHERE id = $1`, [id]);
  } catch (error) {
    console.error("Error al eliminar el arma de la base de datos:", error);
    throw error;
  }
}



app.post('/eliminararmadef', async (req, res) => {
  const armaId = req.body.id;
  try {
    await eliminarArmaDef(armaId); 
    res.redirect('/homeADMIN'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});


async function eliminarArmaDef(id) {
  try {
    await sql(`DELETE FROM productodef WHERE id = $1`, [id]);
  } catch (error) {
    console.error("Error al eliminar el arma de la base de datos:", error);
    throw error;
  }
}
//---------------------------------------------------------------------------editar producto = funcional
async function obtenerArmaPorIdDef(id) {
  try {
      const resultado = await sql(`SELECT * FROM productodef WHERE id = $1`, [id]);
      return resultado[0]; 
  } catch (error) {
      console.error("Error al obtener el arma desde productodef:", error);
      throw error;
  }
}
app.get('/editararmadef', async (req, res) => {
  const armaId = req.query.id;
  const arma = await obtenerArmaPorIdDef(armaId);
  res.render('editararmadef', { arma });
});
app.post('/actualizararmadef', async (req, res) => {
  const armaId = req.body.id;
  const datosActualizados = {
      nombre: req.body.nombre,
      definicion: req.body.definicion,
      link_imagen_principal: req.body.link_imagen_principal,
      link_imagen1: req.body.link_imagen1,
      link_imagen2: req.body.link_imagen2,
      link_imagen3: req.body.link_imagen3,
      link_video: req.body.link_video,
      datof: req.body.datof,
      datos: req.body.datos,
      precio: req.body.precio,
      cantidad: req.body.cantidad
  };

  await actualizarArmaDef(armaId, datosActualizados); 
  res.redirect('/homeADMIN');
});
async function actualizarArmaDef(id, datos) {
  try {
      await sql(
          `UPDATE productodef
           SET nombre = $1, definicion = $2, link_imagen_principal = $3, link_imagen1 = $4, 
               link_imagen2 = $5, link_imagen3 = $6, link_video = $7, datof = $8, 
               datos = $9, precio = $10, cantidad = $11
                WHERE id = $12`,
          [
              datos.nombre,
              datos.definicion,
              datos.link_imagen_principal,
              datos.link_imagen1,
              datos.link_imagen2,
              datos.link_imagen3,
              datos.link_video,
              datos.datof,
              datos.datos,
              datos.precio,
              datos.cantidad,
              id
          ]
      );
  } catch (error) {
      console.error("Error al actualizar el arma en productodef:", error);
      throw error;
  }
}




//------------------------------------------Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
