// Firebase Configuration and Initialization
const firebaseConfig = {
    apiKey: "AIzaSyDvCXDDHiMHzKuBl0ja0pC4cXiZ73zCFyA",
    authDomain: "onshop-3f467.firebaseapp.com",
    projectId: "onshop-3f467",
    storageBucket: "onshop-3f467.firebasestorage.app",
    messagingSenderId: "92266659516",
    appId: "1:92266659516:web:9073446f68da0946745ab9",
    measurementId: "G-33V7P7WS77"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = { uid: null, role: null };
let allProducts = []; // Store all products for filtering

// Pagination variables
let currentPage = 1;
const productsPerPage = 10; // Number of products per page
let lastVisible = null; // To track the last document for pagination
let firstVisible = null; // To track the first document for pagination
let totalProducts = 0; // To track total number of products

// Navigation function
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    if (sectionId === 'products' && currentUser.role !== 'admin') {
        loadProducts(); // Load products only for non-admin users
    }
    if (sectionId === 'cart') loadCart();
    if (sectionId === 'wishlist') loadWishlist();
    if (sectionId === 'history') loadHistory();
}

// Load Products with Category, Search, and Pagination
function loadProducts(page = currentPage) {
    const productsListDiv = document.getElementById('productsList');
    const categoryFilter = document.getElementById('categoryFilter');
    if (!productsListDiv || !categoryFilter) {
        console.error("Required DOM elements (productsList or categoryFilter) not found!");
        return;
    }
    productsListDiv.innerHTML = "Loading products...";

    // Get total number of products (for pagination calculation)
    db.collection('products').get().then(snapshot => {
        totalProducts = snapshot.size;
    });

    let query = db.collection('products')
        .orderBy('name') // Order by name for consistent pagination
        .limit(productsPerPage);

    if (page > 1 && lastVisible) {
        query = query.startAfter(lastVisible);
    }

    query.get()
        .then(snapshot => {
            productsListDiv.innerHTML = "";
            allProducts = []; // Reset the products array for current page
            const categories = new Set(["All"]); // Use Set to avoid duplicates

            if (snapshot.empty) {
                productsListDiv.innerHTML = "No products available.";
                renderPagination();
                return;
            }

            firstVisible = snapshot.docs[0]; // Store first document of current page
            lastVisible = snapshot.docs[snapshot.docs.length - 1]; // Store last document of current page

            snapshot.forEach(doc => {
                const prod = doc.data();
                prod.id = doc.id;
                allProducts.push(prod); // Store the product data for current page

                // Populate categories
                if (prod.category) categories.add(prod.category);

                const imageUrl = prod.imageUrl || 'assets/images/nothing.png';
                const prodDiv = document.createElement('div');
                prodDiv.classList.add('product');
                prodDiv.setAttribute('data-id', doc.id);
                prodDiv.setAttribute('data-category', prod.category || 'Uncategorized');
                prodDiv.setAttribute('data-name', prod.name.toLowerCase());
                const isOutOfStock = (prod.quantity || 0) === 0;
                prodDiv.innerHTML = `
                    <img src="${imageUrl}" alt="${prod.name}" width="200" onerror="this.src='assets/images/nothing.png'"/>
                    <br>
                    <strong>${prod.name}</strong> - $${prod.price}
                    <br><small>Earn Credit: ${prod.credit || 0}</small>
                    <br><small>Quantity Available: ${prod.quantity || 0}</small>
                    <br>
                    <div class="quantity-controls">
                        <button onclick="decreaseQuantity('${doc.id}')">-</button>
                        <span id="quantity-${doc.id}">1</span>
                        <button onclick="increaseQuantity('${doc.id}')">+</button>
                    </div>
                    <br><button onclick="addToCart('${doc.id}')" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</button>
                    <br><button onclick="addToWishlist('${doc.id}')">Add to Wishlist</button>
                `;
                productsListDiv.appendChild(prodDiv);
            });

            // Populate category dropdown
            categoryFilter.innerHTML = '<option value="All">All Categories</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

            // Initialize search and filter
            searchProducts();

            // Render pagination controls
            renderPagination();
        })
        .catch(err => {
            console.error("Error loading products:", err);
            productsListDiv.innerHTML = "Error loading products: " + err.message;
        });
}

// Render Pagination Controls
function renderPagination() {
    const productsListDiv = document.getElementById('productsList');
    const totalPages = Math.ceil(totalProducts / productsPerPage);

    const paginationDiv = document.createElement('div');
    paginationDiv.classList.add('pagination');

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadProducts(currentPage);
        }
    });

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages || allProducts.length < productsPerPage;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadProducts(currentPage);
        }
    });

    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Page ${currentPage} of ${totalPages} `;

    paginationDiv.appendChild(prevButton);
    paginationDiv.appendChild(pageInfo);
    paginationDiv.appendChild(nextButton);

    // Remove any existing pagination controls before appending new ones
    const existingPagination = productsListDiv.parentElement.querySelector('.pagination');
    if (existingPagination) existingPagination.remove();

    productsListDiv.parentElement.appendChild(paginationDiv);
}

// Search and Filter Products
function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const productElements = document.querySelectorAll('.product');

    productElements.forEach(prodDiv => {
        const productName = prodDiv.getAttribute('data-name') || '';
        const productCategory = prodDiv.getAttribute('data-category') || '';

        const matchesSearch = productName.includes(searchTerm);
        const matchesCategory = categoryFilter === 'All' || productCategory === categoryFilter;

        if (matchesSearch && matchesCategory) {
            prodDiv.style.display = 'block';
        } else {
            prodDiv.style.display = 'none';
        }
    });
}

// Increase quantity for a product
function increaseQuantity(productId) {
    const qtySpan = document.getElementById(`quantity-${productId}`);
    let currentQty = parseInt(qtySpan.innerText);
    qtySpan.innerText = currentQty + 1;
}

// Decrease quantity for a product (minimum 1)
function decreaseQuantity(productId) {
    const qtySpan = document.getElementById(`quantity-${productId}`);
    let currentQty = parseInt(qtySpan.innerText);
    if (currentQty > 1) {
        qtySpan.innerText = currentQty - 1;
    }
}

// Function to notify admin about low stock
function notifyAdmin(productName, currentQuantity) {
    const adminNotificationRef = db.collection('adminNotifications');
    adminNotificationRef.add({
        productName: productName,
        currentQuantity: currentQuantity,
        timestamp: new Date(),
        message: `Low stock alert: ${productName} has ${currentQuantity} units left. Please restock soon.`,
        read: false
    }).then(() => {
        console.log(`Notification sent for ${productName} with ${currentQuantity} units left.`);
    }).catch(err => {
        console.error("Error sending notification:", err);
    });
}

// Add to cart without updating stock
function addToCart(productId) {
    if (!currentUser.uid) {
        alert("Please log in to add items to cart.");
        return;
    }

    const qtySpan = document.getElementById(`quantity-${productId}`);
    const quantity = parseInt(qtySpan.innerText);

    db.collection('products').doc(productId).get()
        .then(productDoc => {
            if (!productDoc.exists) {
                alert("Product not found.");
                return;
            }

            const product = productDoc.data();
            const availableQuantity = product.quantity || 0;

            if (availableQuantity < quantity) {
                alert(`Not enough stock for ${product.name}. Only ${availableQuantity} left.`);
                return;
            }

            const cartRef = db.collection('cart').doc(currentUser.uid).collection('items');
            cartRef.where('productId', '==', productId).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        const newQty = doc.data().quantity + quantity;
                        doc.ref.update({ quantity: newQty })
                            .then(() => {
                                alert("Cart updated successfully!");
                                loadCart();
                            });
                    } else {
                        cartRef.add({
                            productId: productId,
                            name: product.name,
                            price: product.price,
                            credit: product.credit,
                            imageUrl: product.imageUrl || 'assets/images/nothing.png',
                            quantity: quantity
                        }).then(() => {
                            alert("Added to cart successfully!");
                            loadCart();
                        });
                    }
                })
                .catch(err => {
                    alert("Error adding to cart: " + err.message);
                });
        })
        .catch(err => {
            alert("Error fetching product: " + err.message);
        });
}

// Increase/decrease cart quantity functions
function increaseCartQuantity(itemId) {
    if (!currentUser.uid) return;

    const qtySpan = document.getElementById(`cart-quantity-${itemId}`);
    let currentQty = parseInt(qtySpan.innerText);
    let newQty = currentQty + 1;

    db.collection('cart').doc(currentUser.uid).collection('items').doc(itemId).update({
        quantity: newQty
    })
    .then(() => {
        qtySpan.innerText = newQty;
        loadCart();
    })
    .catch(err => {
        console.error("Error updating quantity:", err);
    });
}

function decreaseCartQuantity(itemId) {
    if (!currentUser.uid) return;

    const qtySpan = document.getElementById(`cart-quantity-${itemId}`);
    let currentQty = parseInt(qtySpan.innerText);

    if (currentQty > 1) {
        let newQty = currentQty - 1;

        db.collection('cart').doc(currentUser.uid).collection('items').doc(itemId).update({
            quantity: newQty
        })
        .then(() => {
            qtySpan.innerText = newQty;
            loadCart();
        })
        .catch(err => {
            console.error("Error updating quantity:", err);
        });
    }
}

// Load cart items with quantity controls
function loadCart() {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }
    const cartListDiv = document.getElementById('cartList');
    const totalPriceSpan = document.getElementById('totalPrice');
    const availableCreditsSpan = document.getElementById('availableCredits');
    const creditValueSpan = document.getElementById('creditValue');
    const useCreditsCheckbox = document.getElementById('useCredits');
    cartListDiv.innerHTML = "";
    let totalPrice = 0;

    db.collection('users').doc(currentUser.uid).get().then(userDoc => {
        const userCredits = userDoc.data().credit || 0;
        const creditPoints = Math.floor(userCredits / 100);
        availableCreditsSpan.innerText = creditPoints;
        creditValueSpan.innerText = userCredits.toFixed(2);

        db.collection('cart').doc(currentUser.uid).collection('items').get()
            .then(snapshot => {
                if (snapshot.empty) {
                    cartListDiv.innerHTML = "Your cart is empty.";
                    totalPriceSpan.innerText = "0";
                    useCreditsCheckbox.disabled = true;
                    return;
                }

                const promises = [];
                snapshot.forEach(doc => {
                    const item = doc.data();
                    if (!item.imageUrl && item.productId) {
                        const promise = db.collection('products').doc(item.productId).get()
                            .then(productDoc => {
                                if (productDoc.exists) {
                                    item.imageUrl = productDoc.data().imageUrl || 'assets/images/nothing.png';
                                }
                                return { doc, item };
                            });
                        promises.push(promise);
                    } else {
                        item.imageUrl = item.imageUrl || 'assets/images/nothing.png';
                        promises.push(Promise.resolve({ doc, item }));
                    }
                });

                return Promise.all(promises);
            })
            .then(results => {
                if (!results || results.length === 0) return;

                results.forEach(({ doc, item }) => {
                    const itemTotal = item.price * item.quantity;
                    totalPrice += itemTotal;
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('cart-item');
                    itemDiv.innerHTML = `
                        <div class="cart-item-content">
                            <img src="${item.imageUrl}" alt="${item.name}" width="80" onerror="this.src='assets/images/nothing.png'"/>
                            <div class="cart-item-details">
                                <div class="cart-item-name">${item.name}</div>
                                <div class="cart-item-price">₹${item.price}</div>
                                <div class="quantity-controls">
                                    <button onclick="decreaseCartQuantity('${doc.id}')">-</button>
                                    <span id="cart-quantity-${doc.id}">${item.quantity}</span>
                                    <button onclick="increaseCartQuantity('${doc.id}')">+</button>
                                </div>
                                <div class="cart-item-total">Total: ₹${itemTotal}</div>
                                <button class="remove-btn" onclick="removeFromCart('${doc.id}')">Remove</button>
                            </div>
                        </div>
                    `;
                    cartListDiv.appendChild(itemDiv);
                });

                totalPriceSpan.innerText = totalPrice.toFixed(2);
                useCreditsCheckbox.disabled = false;
                updateTotalWithCredits();
            })
            .catch(err => {
                console.error("Error loading cart:", err);
                cartListDiv.innerHTML = "Error loading cart.";
            });
    });
}

// Add to Wishlist
function addToWishlist(productId) {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }

    db.collection('products').doc(productId).get()
        .then(doc => {
            if (doc.exists) {
                const product = doc.data();
                product.id = doc.id;
                const wishlistRef = db.collection('users').doc(currentUser.uid).collection('wishlist');

                wishlistRef.where('name', '==', product.name).get()
                    .then(snapshot => {
                        if (snapshot.empty) {
                            wishlistRef.add(product)
                                .then(() => {
                                    alert(`${product.name} added to wishlist.`);
                                    loadWishlist();
                                })
                                .catch(err => {
                                    alert(err.message);
                                });
                        } else {
                            alert(`${product.name} is already in your wishlist.`);
                        }
                    })
                    .catch(err => {
                        alert(err.message);
                    });
            } else {
                alert("Product not found.");
            }
        })
        .catch(err => {
            alert("Error fetching product: " + err.message);
        });
}

// Load Wishlist
function loadWishlist() {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }
    const wishlistListDiv = document.getElementById('wishlistList');
    wishlistListDiv.innerHTML = "Loading wishlist...";
    db.collection('users').doc(currentUser.uid).collection('wishlist').get()
        .then(snapshot => {
            wishlistListDiv.innerHTML = "";
            if (snapshot.empty) {
                wishlistListDiv.innerHTML = "Your wishlist is empty.";
                return;
            }
            snapshot.forEach(doc => {
                const item = doc.data();
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('wishlist-item');
                itemDiv.innerHTML = `
                    <img src="${item.imageUrl || 'assets/images/nothing.png'}" alt="${item.name}" width="100" onerror="this.src='assets/images/nothing.png'"/>
                    <br>
                    ${item.name} - $${item.price}
                    <br>
                    <button onclick="addToCartFromWishlist('${doc.id}')">Add to Cart</button>
                    <button onclick="removeFromWishlist('${doc.id}')">Remove</button>
                `;
                wishlistListDiv.appendChild(itemDiv);
            });
        })
        .catch(err => {
            console.error("Error loading wishlist:", err);
            wishlistListDiv.innerHTML = "Error loading wishlist.";
        });
}

// Remove from Wishlist
function removeFromWishlist(docId) {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }
    db.collection('users').doc(currentUser.uid).collection('wishlist').doc(docId).delete()
        .then(() => {
            alert("Item removed from wishlist!");
            loadWishlist();
        })
        .catch(err => {
            console.error("Error removing item from wishlist:", err);
            alert("Error removing item from wishlist.");
        });
}

// Add to Cart from Wishlist
function addToCartFromWishlist(wishlistDocId) {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }

    db.collection('users').doc(currentUser.uid).collection('wishlist').doc(wishlistDocId).get()
        .then(doc => {
            if (doc.exists) {
                const item = doc.data();
                const productId = item.id;

                if (!productId) {
                    alert("Product ID not found in wishlist item.");
                    return;
                }

                db.collection('products').doc(productId).get()
                    .then(productDoc => {
                        if (productDoc.exists) {
                            const product = productDoc.data();
                            const availableQuantity = product.quantity || 0;

                            if (availableQuantity < 1) {
                                alert(`Not enough stock for ${product.name}.`);
                                return;
                            }

                            const cartRef = db.collection('cart').doc(currentUser.uid).collection('items');
                            cartRef.where('productId', '==', productId).get()
                                .then(snapshot => {
                                    if (!snapshot.empty) {
                                        const cartDoc = snapshot.docs[0];
                                        const newQty = cartDoc.data().quantity + 1;
                                        if (newQty > availableQuantity) {
                                            alert(`Cannot add ${newQty} of ${product.name}. Only ${availableQuantity} left in stock.`);
                                            return;
                                        }
                                        cartDoc.ref.update({ quantity: newQty })
                                            .then(() => {
                                                alert("Item added to cart from wishlist!");
                                                loadCart();
                                                removeFromWishlist(wishlistDocId);
                                            });
                                    } else {
                                        cartRef.add({
                                            productId: productId,
                                            name: product.name,
                                            price: product.price,
                                            credit: product.credit,
                                            imageUrl: product.imageUrl || 'assets/images/nothing.png',
                                            quantity: 1
                                        }).then(() => {
                                            alert("Item added to cart from wishlist!");
                                            loadCart();
                                            removeFromWishlist(wishlistDocId);
                                        });
                                    }
                                })
                                .catch(err => {
                                    alert("Error adding to cart: " + err.message);
                                });
                        } else {
                            alert("Product not found in products collection.");
                        }
                    })
                    .catch(err => {
                        alert("Error fetching product: " + err.message);
                    });
            } else {
                alert("Wishlist item not found.");
            }
        })
        .catch(err => {
            alert("Error fetching wishlist item: " + err.message);
        });
}

// Update total price with credits if checkbox is checked
function updateTotalWithCredits() {
    const useCreditsCheckbox = document.getElementById('useCredits');
    const totalPriceSpan = document.getElementById('totalPrice');
    const creditValueSpan = document.getElementById('creditValue');
    const discountAmountSpan = document.getElementById('discountAmount');
    const creditDiscountDiv = document.getElementById('creditDiscount');
    const finalTotalDiv = document.getElementById('finalTotal');
    const finalPriceSpan = document.getElementById('finalPrice');

    const totalPrice = parseFloat(totalPriceSpan.innerText);
    const availableCreditValue = parseFloat(creditValueSpan.innerText);

    if (useCreditsCheckbox.checked && availableCreditValue > 0) {
        const discount = Math.min(availableCreditValue, totalPrice);
        discountAmountSpan.innerText = discount.toFixed(2);
        creditDiscountDiv.style.display = 'block';
        finalPriceSpan.innerText = (totalPrice - discount).toFixed(2);
        finalTotalDiv.style.display = 'block';
    } else {
        creditDiscountDiv.style.display = 'none';
        finalTotalDiv.style.display = 'none';
    }
}

// Remove item from cart
function removeFromCart(itemId) {
    if (!currentUser.uid) {
        alert("Please login first!");
        return;
    }
    db.collection('cart').doc(currentUser.uid).collection('items').doc(itemId).delete()
        .then(() => {
            alert("Item removed from cart!");
            loadCart();
        })
        .catch(err => {
            console.error("Error removing item from cart:", err);
            alert("Error removing item from cart.");
        });
}

// Enhanced Place Order function with stock update
function placeOrder() {
    if (!currentUser || !currentUser.uid) {
        alert("Please login first!");
        return;
    }
    const userCartRef = db.collection('cart').doc(currentUser.uid).collection('items');
    const userRef = db.collection('users').doc(currentUser.uid);
    const billDetailsDiv = document.getElementById('billDetails');
    const creditsEarnedSpan = document.getElementById('creditsEarned');
    const useCreditsCheckbox = document.getElementById('useCredits');
    const totalPriceSpan = document.getElementById('totalPrice');
    const discountAmountSpan = document.getElementById('discountAmount');

    userRef.get().then(userDoc => {
        if (!userDoc.exists) {
            alert("User profile not found!");
            return;
        }

        const userData = userDoc.data();
        const userEmail = userData.email || currentUser.email;
        const shippingAddress = userData.address || "Default Shipping Address";

        userCartRef.get().then(snapshot => {
            let cartItems = [];
            let totalPrice = 0;
            let totalCredit = 0;

            if (snapshot.empty) {
                alert("Your cart is empty!");
                return;
            }

            snapshot.forEach(doc => {
                const item = doc.data();
                cartItems.push(item);
                totalPrice += item.price * item.quantity;
                totalCredit += item.credit * item.quantity;
            });

            let discount = 0;
            let finalAmount = totalPrice;
            if (useCreditsCheckbox.checked) {
                const availableCredits = parseFloat(document.getElementById('creditValue').innerText);
                discount = Math.min(availableCredits, totalPrice);
                finalAmount = totalPrice - discount;
            }

            const gstAmount = (finalAmount * 0.18).toFixed(2);
            const subTotal = finalAmount - parseFloat(gstAmount);

            const orderNumber = "ST" + Math.floor(100000 + Math.random() * 900000);
            const currentDate = new Date();
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 5);

            const batch = db.batch();
            const historyRef = db.collection('users').doc(currentUser.uid).collection('history').doc();
            const orderId = historyRef.id;

            cartItems.forEach(item => {
                const productRef = db.collection('products').doc(item.productId);
                batch.update(productRef, {
                    quantity: firebase.firestore.FieldValue.increment(-item.quantity)
                });
            });

            batch.set(historyRef, {
                userEmail: userEmail,
                orderNumber: orderNumber,
                items: cartItems,
                totalPrice: totalPrice,
                totalCredit: totalCredit,
                creditDiscount: discount,
                subTotal: subTotal,
                gstAmount: parseFloat(gstAmount),
                finalAmount: finalAmount,
                shippingAddress: shippingAddress,
                orderDate: currentDate,
                estimatedDelivery: deliveryDate,
                paymentMethod: "Online Payment",
                status: "order received"
            });

            cartItems.forEach(item => {
                db.collection('products').doc(item.productId).get().then(prodDoc => {
                    const newQuantity = (prodDoc.data().quantity || 0) - item.quantity;
                    if (newQuantity <= 5) {
                        notifyAdmin(item.name, newQuantity);
                    }
                });
            });

            batch.commit().then(() => {
                creditsEarnedSpan.innerText = totalCredit;
                billDetailsDiv.innerHTML = generateBillContent(orderId, orderNumber, currentDate, deliveryDate, userEmail, shippingAddress, cartItems, subTotal, gstAmount, discount, finalAmount, totalCredit);

                document.getElementById('billSection').style.display = 'block';

                const creditValueEarned = totalCredit * 100;
                const newCredit = userData.credit - discount + creditValueEarned;
                userRef.update({ credit: newCredit });

                snapshot.forEach(doc => doc.ref.delete());
                alert("Order placed successfully! Check your invoice below.");
                loadCart();
                loadProducts();
                loadHistory();
            }).catch(err => {
                console.error("Error placing order:", err);
                alert("Error placing order.");
            });
        }).catch(err => {
            console.error("Error fetching cart:", err);
            alert("Error processing cart.");
        });
    }).catch(err => {
        console.error("Error fetching user data:", err);
        alert("Error retrieving user information.");
    });
}

// Helper function to generate bill content
function generateBillContent(orderId, orderNumber, orderDate, deliveryDate, userEmail, shippingAddress, cartItems, subTotal, gstAmount, discount, finalAmount, totalCredit) {
    return `
        <div class="invoice-container">
            <div class="invoice-header">
                <div class="logo-container">
                    <h1>ShopTrendy</h1>
                    <p>Your Trendy Shopping Destination</p>
                </div>
                <div class="invoice-details">
                    <h2>INVOICE</h2>
                    <table>
                        <tr><td><strong>Invoice No:</strong></td><td>${orderNumber}</td></tr>
                        <tr><td><strong>Order ID:</strong></td><td>${orderId}</td></tr>
                        <tr><td><strong>Order Date:</strong></td><td>${orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                        <tr><td><strong>Est. Delivery:</strong></td><td>${deliveryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                    </table>
                </div>
            </div>

            <div class="customer-details">
                <div class="billing-details">
                    <h3>BILLING ADDRESS</h3>
                    <p>${userEmail}</p>
                    <p>${shippingAddress}</p>
                </div>
                <div class="shipping-details">
                    <h3>SHIPPING ADDRESS</h3>
                    <p>${userEmail}</p>
                    <p>${shippingAddress}</p>
                </div>
            </div>

            <div class="order-summary">
                <h3>ORDER SUMMARY</h3>
                <table class="bill-table">
                    <thead><tr><th>S.No</th><th>Image</th><th>Product</th><th>Unit Price</th><th>Quantity</th><th>Net Amount</th></tr></thead>
                    <tbody>
                        ${cartItems.map((item, index) => {
                            const itemTotal = item.price * item.quantity;
                            const imageUrl = item.imageUrl || 'assets/images/nothing.png';
                            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td><img src="${imageUrl}" alt="${item.name}" width="60" onerror="this.src='assets/images/nothing.png'"/></td>
                                    <td><p class="product-name">${item.name}</p><p class="product-sku">SKU: PROD${Math.floor(1000 + Math.random() * 9000)}</p></td>
                                    <td>₹${item.price.toLocaleString('en-IN')}</td>
                                    <td>${item.quantity}</td>
                                    <td>₹${itemTotal.toLocaleString('en-IN')}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="price-summary">
                <table class="price-details">
                    <tr><td>Subtotal:</td><td>₹${subTotal.toLocaleString('en-IN')}</td></tr>
                    <tr><td>GST (18%):</td><td>₹${parseFloat(gstAmount).toLocaleString('en-IN')}</td></tr>
                    <tr><td>Shipping:</td><td>FREE</td></tr>
                    ${discount > 0 ? `<tr><td>Credit Discount:</td><td>-₹${discount.toLocaleString('en-IN')}</td></tr>` : ''}
                    <tr class="total-row"><td>Total Amount:</td><td>₹${finalAmount.toLocaleString('en-IN')}</td></tr>
                </table>
            </div>

            <div class="payment-info">
                <h3>PAYMENT INFORMATION</h3>
                <p><strong>Payment Method:</strong> Online Payment</p>
                <p><strong>Transaction ID:</strong> TXN${Math.floor(100000 + Math.random() * 900000)}</p>
                <p><strong>Credits Earned:</strong> ${totalCredit} (₹${(totalCredit * 100).toLocaleString('en-IN')})</p>
            </div>

            <div class="invoice-footer">
                <div class="footer-content">
                    <p>Thank you for shopping with ShopTrendy!</p>
                     <p>For any questions or concerns regarding this order, please contact our customer service:</p>
                    <p>Email: support@shoptrendy.com | Phone: +91 1234567890</p>
                </div>
                <div class="terms">
                    <p>Terms & Conditions Apply. All prices are inclusive of GST.</p>
                    <p>© 2025 ShopTrendy. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

// Enhanced Print Bill function
function printBill() {
    const billSection = document.getElementById('billDetails').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>ShopTrendy - Invoice</title>
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Poppins', sans-serif; padding: 20px; color: #333; line-height: 1.5; }
                    .invoice-container { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; }
                    .invoice-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #e0e0e0; padding-bottom: 20px; }
                    .logo-container h1 { margin: 0; color: #6a11cb; }
                    .logo-container p { margin: 5px 0; color: #666; }
                    .invoice-details { text-align: right; }
                    .invoice-details h2 { color: #6a11cb; margin-top: 0; }
                    .invoice-details td { padding: 3px 0; }
                    .customer-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .billing-details, .shipping-details { width: 48%; }
                    h3 { color: #6a11cb; font-size: 16px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
                    .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .bill-table th { background-color: #f5f5f5; color: #333; padding: 10px; text-align: left; font-weight: 500; }
                    .bill-table td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
                    .product-name { font-weight: 500; margin: 0 0 5px 0; }
                    .product-sku { font-size: 12px; color: #666; margin: 0; }
                    .price-details { width: 300px; margin-left: auto; margin-bottom: 30px; }
                    .price-details td { padding: 8px 0; }
                    .price-details td:first-child { text-align: left; }
                    .price-details td:last-child { text-align: right; font-weight: 500; }
                    .total-row { font-size: 18px; font-weight: 600; color: #6a11cb; }
                    .payment-info { margin-bottom: 30px; }
                    .invoice-footer { border-top: 1px solid #e0e0e0; padding-top: 20px; text-align: center; font-size: 14px; color: #666; }
                    @media print { body { padding: 0; font-size: 12px; } button { display: none; } }
                </style>
            </head>
            <body>
                ${billSection}
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background-color: #6a11cb; color: white; border: none; border-radius: 4px; cursor: pointer;">Print Invoice</button>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
    }, 500);
}

// Enhanced Load History function
function loadHistory() {
    if (!currentUser || !currentUser.uid) {
        alert("Please login first!");
        return;
    }

    const historyListDiv = document.getElementById('historyList');
    if (!historyListDiv) {
        console.error("History list div not found in the DOM!");
        return;
    }

    historyListDiv.innerHTML = "<p>Loading your order history...</p>";

    db.collection('users')
        .doc(currentUser.uid)
        .collection('history')
        .orderBy("orderDate", "desc")
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                historyListDiv.innerHTML = "<p class='empty-message'>No order history available.</p>";
                return;
            }

            historyListDiv.innerHTML = "";

            snapshot.forEach(doc => {
                const order = doc.data();
                const orderId = doc.id;

                const orderDate = order.orderDate && order.orderDate.toDate
                    ? order.orderDate.toDate().toLocaleString()
                    : new Date(order.orderDate).toLocaleString();

                const deliveryDate = order.estimatedDelivery && order.estimatedDelivery.toDate
                    ? order.estimatedDelivery.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : "Not available";

                const orderDiv = document.createElement('div');
                orderDiv.classList.add('order-history-item');
                orderDiv.innerHTML = `
                    <div class="order-summary-card">
                        <div class="order-header">
                            <div class="order-basic-info">
                                <h3>Order #${order.orderNumber || 'N/A'}</h3>
                                <p>Placed on: ${orderDate}</p>
                                <p>Status: <span class="order-status">${order.status || 'order received'}</span></p>
                            </div>
                            <div class="order-amount">
                                <p>Total: ₹${order.finalAmount ? order.finalAmount.toLocaleString('en-IN') : 'N/A'}</p>
                            </div>
                        </div>

                        <div class="order-preview">
                            ${order.items.slice(0, 3).map(item => {
                                const imageUrl = item.imageUrl || 'assets/images/nothing.png';
                                return `<img src="${imageUrl}" alt="${item.name}" width="60" onerror="this.src='assets/images/nothing.png'"/>`;
                            }).join('')}
                            ${order.items.length > 3 ? `<span class="more-items">+${order.items.length - 3} more</span>` : ''}
                        </div>

                        <div id="order-details-${orderId}" class="order-details" style="display: none;">
                            <h4>Order Items</h4>
                            <table class="order-items-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Price</th>
                                        <th>Quantity</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => {
                                        const itemTotal = item.price * item.quantity;
                                        const imageUrl = item.imageUrl || 'assets/images/nothing.png';
                                        return `
                                            <tr>
                                                <td>
                                                    <div class="product-info">
                                                        <img src="${imageUrl}" alt="${item.name}" width="50" onerror="this.src='assets/images/nothing.png'"/>
                                                        <span>${item.name}</span>
                                                    </div>
                                                </td>
                                                <td>₹${item.price.toLocaleString('en-IN')}</td>
                                                <td>${item.quantity}</td>
                                                <td>₹${itemTotal.toLocaleString('en-IN')}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>

                            <div class="order-address">
                                <div class="delivery-info">
                                    <h4>Delivery Information</h4>
                                    <p><strong>Expected Delivery:</strong> ${deliveryDate}</p>
                                    <p><strong>Shipping Address:</strong><br>${order.shippingAddress || 'Default Shipping Address'}</p>
                                </div>

                                <div class="payment-info">
                                    <h4>Payment Information</h4>
                                    <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Online Payment'}</p>
                                    <p><strong>Subtotal:</strong> ₹${order.subTotal ? order.subTotal.toLocaleString('en-IN') : order.finalAmount.toLocaleString('en-IN')}</p>
                                    ${order.gstAmount ? `<p><strong>GST:</strong> ₹${order.gstAmount.toLocaleString('en-IN')}</p>` : ''}
                                    ${order.creditDiscount > 0 ? `<p><strong>Credit Discount:</strong> ₹${order.creditDiscount.toLocaleString('en-IN')}</p>` : ''}
                                    <p><strong>Total Amount:</strong> ₹${order.finalAmount.toLocaleString('en-IN')}</p>
                                    <p><strong>Credits Earned:</strong> ${order.totalCredit}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                historyListDiv.appendChild(orderDiv);
            });
        })
        .catch(err => {
            console.error("Error loading history:", err);
            historyListDiv.innerHTML = `<p class='error-message'>Error loading order history: ${err.message}</p>`;
        });
}

// Show Login Function
function showLogin(event) {
    event.preventDefault();
    const loginFormContainer = document.querySelector('#login .form-container');
    loginFormContainer.innerHTML = `
        <h2>Login</h2>
        <form id="loginForm">
            <input type="email" id="loginEmail" placeholder="Email" required>
            <input type="password" id="loginPassword" placeholder="Password" required>
            <select id="loginRole" required>
                <option value="" disabled selected>Select Role</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
            <button type="submit" class="btn">Login</button>
        </form>
        <div id="loginMessage" class="message"></div>
        <div class="new-user">
            New user? <a href="#signup" onclick="showSignUp(event)" class="signup-link">Sign Up</a>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const role = document.getElementById('loginRole').value;

        auth.signInWithEmailAndPassword(email, password)
            .then(cred => {
                currentUser = cred.user;
                currentUser.role = role;
                document.getElementById('loginMessage').innerText = "Login successful!";
                db.collection('users').doc(currentUser.uid).set({
                    role: role,
                    credit: 0
                }, { merge: true });
                if (role === "admin" && email === "ragasandhiya@gmail.com") {
                    window.location.href = "admin.html";
                } else if (role === "user") {
                    document.body.setAttribute('data-theme', 'light');
                    if (typeof createMouseTail === 'function') createMouseTail(); // Check if function exists
                    showSection('products');
                } else {
                    document.getElementById('loginMessage').innerText = "Not authorized as admin.";
                    auth.signOut();
                }
            })
            .catch(err => {
                document.getElementById('loginMessage').innerText = err.message;
            });
    });
}

// Show Sign Up Function
function showSignUp(event) {
    event.preventDefault();
    const loginFormContainer = document.querySelector('#login .form-container');
    loginFormContainer.innerHTML = `
        <h2>Sign Up</h2>
        <form id="signupForm">
            <input type="email" id="signupEmail" placeholder="Email" required>
            <input type="password" id="signupPassword" placeholder="Password" required>
            <select id="signupRole" required>
                <option value="" disabled selected>Select Role</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
            <button type="submit" class="btn">Sign Up</button>
        </form>
        <div id="signupMessage" class="message"></div>
        <div class="existing-user">
            Already have an account? <a href="#login" onclick="showLogin(event)" class="login-link">Login</a>
        </div>
    `;

    document.getElementById('signupForm').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const role = document.getElementById('signupRole').value;

        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => {
                const user = cred.user;
                return db.collection('users').doc(user.uid).set({
                    email: email,
                    role: role,
                    credit: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => {
                document.getElementById('signupMessage').innerText = "Sign up successful! Please log in.";
                showLogin(event);
            })
            .catch(err => {
                document.getElementById('signupMessage').innerText = `Error: ${err.message}`;
            });
    });
}

// Logout
function logout() {
    auth.signOut().then(() => {
        currentUser = { uid: null, role: null };
        alert("Logged out successfully.");
        showSection('home');
    });
}

// Monitor authentication state
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser.uid = user.uid;
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                currentUser.role = doc.data().role || 'user';
                if (currentUser.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    showSection('home');
                }
            })
            .catch(err => console.error("Error fetching user role:", err));
    } else {
        currentUser = { uid: null, role: null };
        showSection('home');
    }
});

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    showLogin(new Event('init')); // Load login form by default
    const wishlistLink = document.querySelector('.nav-link[onclick^="showSection(\'wishlist\'"]');
    if (wishlistLink) {
        wishlistLink.addEventListener('click', () => {
            loadWishlist();
        });
    }
});

// Existing app.js code remains unchanged, append this at the end

// Typing Effect for Welcome Message
document.addEventListener('DOMContentLoaded', () => {
    const welcomeText = document.querySelector('.hero h2');
    const originalText = welcomeText.innerText;
    welcomeText.innerText = '';
    
    let i = 0;
    function typeEffect() {
        if (i < originalText.length) {
            welcomeText.innerText += originalText.charAt(i);
            i++;
            setTimeout(typeEffect, 100);
        }
    }
    
    // Start typing effect when home section is visible
    if (document.getElementById('home').classList.contains('active')) {
        typeEffect();
    }

    // Re-trigger typing effect when navigating back to home
    const homeLink = document.querySelector('.nav-link[onclick="showSection(\'home\')"]');
    homeLink.addEventListener('click', () => {
        welcomeText.innerText = '';
        i = 0;
        typeEffect();
    });
});