const CartModel = require("../models/cartModel");
const UserModel = require("../models/userModel");
const ProductModel = require("../models/productModel");
const Validator = require("../utilities/validator");

//*********************************************CREATE or ADD CART***************************************************** */

const createCart = async function (req, res) {
  try {
    const requestBody = req.body;
    const queryParams = req.query;
    const userId = req.params.userId;

    // query params must be empty
    if (Validator.isValidInputBody(queryParams)) {
      return res
        .status(404)
        .send({ status: false, message: " page not found" });
    }

    // using destructuring
    const { productId, cartId } = requestBody;

    // product id is required
    if (!Validator.isValidInputValue(productId)) {
      return res.status(400).send({
        status: false,
        message: "Product ID is required ",
      });
    }
    // product id should be a valid mongoose ObjectId
    if (!Validator.isValidObjectId(productId)) {
      return res
        .status(400)
        .send({ status: false, message: "Product ID is not valid" });
    }

    const productByProductId = await ProductModel.findOne({
      _id: productId,
      isDeleted: false,
      deletedAt: null,
    });

    if (!productByProductId) {
      return res
        .status(404)
        .send({ status: false, message: `No product found by ${productId}` });
    }

    // if product is out of stock
    if (productByProductId.installments === 0) {
      return res.status(400).send({
        status: false,
        message: `${productId} is out of stock currently`,
      });
    }

    // if cart Id is coming from requestBody so first validating cart id then updating cart data
    if (requestBody.hasOwnProperty("cartId")) {
      // cart Id must not be an empty string
      if (!Validator.isValidInputValue(cartId)) {
        return res
          .status(400)
          .send({ status: false, message: "cartId could not be blank" });
      }

      // cart Id must be a valid mongoose Object Id
      if (!Validator.isValidObjectId(cartId)) {
        return res
          .status(400)
          .send({ status: false, message: "cartId  is not valid" });
      }

      const cartByCartId = await CartModel.findById(cartId);

      if (!cartByCartId) {
        return res
          .status(404)
          .send({ status: false, message: `No cart found by ${cartId}` });
      }

      // checking whether user has any cart
      const cartByUserId = await CartModel.findOne({ userId: userId });

      //  if cart is not found by userId that mean some other user's cart Id is coming from request body
      if (!cartByUserId) {
        return res.status(403).send({
          status: false,
          message: `User is not allowed to update this cart`,
        });
      }

      // if user is not matching in cart found by userId and cart found by cart id that mean some other user's cart id is coming from request body
      if (cartByCartId.userId.toString() !== cartByUserId.userId.toString()) {
        return res.status(403).send({
          status: false,
          message: `User is not allowed to update this cart`,
        });
      }

      // applying higher order function "map" on items array of cart to get an array of product id in string
      const isProductExistsInCart = cartByCartId.items.map(
        (x) => (x["productId"] = x["productId"].toString())
      );

      // if product id coming from request body is present in cart then updating its quantity
      if (isProductExistsInCart.includes(productId)) {

          /* condition :  cartId and items array element which has product id coming from request body
            update :     totalItems will increase by 1, totalPrice will increase by price of that product 
                         and items array element(product) quantity will increase by one*/

        const updateExistingProductQuantity = await CartModel.findOneAndUpdate(
          { _id: cartId, "items.productId": productId },
          {
            $inc: {
              totalItems: +1,
              totalPrice: +productByProductId.price,
              "items.$.quantity": +1,
            },
          },
          { new: true }
        );
        return res.status(200).send({
          status: true,
          message: "Item quantity updated to cart",
          data: updateExistingProductQuantity,
        });
      }

      // if product id coming from request body is not present in cart then we have to add that product in items array of cart
      const updateNewProductInItems = await CartModel.findOneAndUpdate(
        { _id: cartId },
        {
          $addToSet: { items: { productId: productId, quantity: 1 } },
          $inc: { totalItems: +1, totalPrice: +productByProductId.price },
        },
        { new: true }
      );

      return res.status(200).send({
        status: true,
        message: "Item updated to cart",
        data: updateNewProductInItems,
      });

      // if cart ID is not present in request body then first we have to check whether user owns any cart then we create a cart for the product
    } else {
      const cartByUserId = await CartModel.findOne({ userId: userId });

      if (cartByUserId) {
        return res.status(400).send({
          status: false,
          message: `cart already exist, provide cart id`,
        });
      }

      // if no cart found by userID then creating a new cart the product coming from request body
      const productData = [
        {
          productId: productId,
          quantity: 1,
        },
      ];

      const cartData = {
        userId: userId,
        items: productData,
        totalPrice: productByProductId.price,
        totalItems: 1,
      };

      const newCart = await CartModel.create(cartData);

      return res
        .status(200)
        .send({ status: true, message: "Item added to cart", data: newCart });
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

//************************************UPDATE CART********************************************************** */

const updateCart = async function (req, res) {
  try {
    const requestBody = req.body;
    const queryParams = req.query;
    const userId = req.params.userId;

    if (Validator.isValidInputBody(queryParams)) {
      return res
        .status(404)
        .send({ status: false, message: " page not found" });
    }

    if (!Validator.isValidInputBody(requestBody)) {
      return res.status(404).send({
        status: false,
        message: "data is required to add products in cart",
      });
    }

    const { productId, cartId, removeProduct } = requestBody;

    if (!Validator.isValidInputValue(productId)) {
      return res
        .status(400)
        .send({ status: false, message: "Product ID is required" });
    }

    if (!Validator.isValidObjectId(productId)) {
      return res
        .status(400)
        .send({ status: false, message: "Product ID is not valid" });
    }

    const productByProductId = await ProductModel.findOne({
      _id: productId,
      isDeleted: false,
      deletedAt: null,
    });

    if (!productByProductId) {
      return res
        .status(404)
        .send({ status: false, message: `No product found by ${productId}` });
    }

    if (!Validator.isValidInputValue(cartId)) {
      return res
        .status(400)
        .send({ status: false, message: "cart Id is required" });
    }

    if (!Validator.isValidObjectId(cartId)) {
      return res
        .status(400)
        .send({ status: false, message: "cart Id  is not valid" });
    }

    const cartByCartId = await CartModel.findById(cartId);

    if (!cartByCartId) {
      return res
        .status(404)
        .send({ status: false, message: `No cart found by ${cartId}` });
    }

    const cartByUserId = await CartModel.findOne({ userId: userId });

    if (!cartByUserId) {
      return res.status(403).send({
        status: false,
        message: `User is not allowed to update this cart`,
      });
    }

    if (cartByCartId.userId.toString() !== cartByUserId.userId.toString()) {
      return res.status(403).send({
        status: false,
        message: `User is not allowed to update this cart`,
      });
    }

    if (![0, 1].includes(removeProduct)) {
      return res.status(400).send({
        status: false,
        message:
          "RemoveProduct is required and its value must be either 0 or 1",
      });
    }

    // creating an array of products with quantity and product id in string format
    const allProductsInCart = cartByCartId.items.map((x) => ({
      productId: x["productId"].toString(),
      quantity: x["quantity"],
    }));

    // checking product id coming from request body is present in the cart
    const isProductExistsInCart = allProductsInCart.filter(
      (x) => x.productId == productId
    );

    if (isProductExistsInCart.length === 0) {
      return res.status(404).send({
        status: false,
        message: "No product found by this product id inside cart",
      });
    }
    // identifying quantity of that product
    const productQuantity = isProductExistsInCart[0].quantity;

    // if client want to reduce the quantity by one
    if (removeProduct === 1) {

       // first check whether productQuantity is  greater than one then reduce the quantity else remove whole  product
      if (productQuantity > 1) {
        const decreaseExistingProductQuantity =
          await CartModel.findOneAndUpdate(
            { _id: cartId, "items.productId": productId },
            {
              $inc: {
                totalItems: -1,
                totalPrice: -productByProductId.price,
                "items.$.quantity": -1,
              },
            },
            { new: true }
          );

        return res.status(200).send({
          status: true,
          message: "Item quantity reduced in cart",
          data: decreaseExistingProductQuantity,
        });
      } else {
        const eraseProductFromCart = await CartModel.findOneAndUpdate(
          { _id: cartId },
          {
            $pull: { items: isProductExistsInCart[0] },
            $inc: { totalItems: -1, totalPrice: -productByProductId.price },
          },
          { new: true }
        );

        return res.status(200).send({
          status: true,
          message: "Item updated to cart",
          data: eraseProductFromCart,
        });
      }
    } else {
      const removeProductFromCart = await CartModel.findOneAndUpdate(
        { _id: cartId },
        {
          $pull: { items: isProductExistsInCart[0] },
          $inc: {
            totalItems: -productQuantity,
            totalPrice: -(productQuantity * productByProductId.price),
          },
        },
        { new: true }
      );

      return res.status(200).send({
        status: true,
        message: "Item removed from cart",
        data: removeProductFromCart,
      });
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

//***********************************GET CART DETAILS********************************************* */

const getCartDetails = async function(req, res){
    try{
        const userId = req.params.userId
        const queryParams = req.query;
    
    if (Validator.isValidInputBody(queryParams)) {
      return res
        .status(404)
        .send({ status: false, message: " page not found" });
    }

    const cartByUserId = await CartModel.findOne({ userId: userId });

    if (!cartByUserId) {
      return res.status(404).send({
        status: false,
        message: `no cart found by ${userId}`,
      });
    }

    return res.status(200).send({status: true, message : "Cart details are here", data : cartByUserId})


    }catch(error){
        res.status(500).send({error : error.message})
    }
}

//************************************EMPTY CART***************************************************** */

const emptyCart = async function(req, res){
    try{
        const userId = req.params.userId
        const queryParams = req.query;
    
    if (Validator.isValidInputBody(queryParams)) {
      return res
        .status(404)
        .send({ status: false, message: " page not found" });
    }

    const cartByUserId = await CartModel.findOne({ userId: userId });

    if (!cartByUserId) {
      return res.status(404).send({
        status: false,
        message: `no cart found by ${userId}`,
      });
    }

    const makeCartEmpty = await CartModel.findOneAndUpdate(
            {userId : userId},
            {$set : {items : [], totalPrice : 0, totalItems : 0 }},
            {new : true}
    )
    return res.status(200).send({status: true, message : "cart made empty successfully", data : makeCartEmpty})

    }catch(error){
        res.status(500).send({error : error.message})
    }
}

module.exports = {
  createCart,
  updateCart,
  getCartDetails,
  emptyCart
};
