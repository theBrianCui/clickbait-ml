import tensorflow as tf
sess = tf.InteractiveSession()

x = tf.constant([[1, 1, 1], [1, 1, 1]])
x = tf.add(x, tf.reduce_sum(x))
x = tf.Print(x, [x], message="This is x: ")
x.eval()


# x = tf.Print(x, [x], message="This is x: ")
# x = add(x,tf.reduce_sum(x, 0)  # [2, 2, 2]
# x = tf.Print(x, [x], message="This is x: ")
# tf.reduce_sum(x, 1)  # [3, 3]
# x = tf.Print(x, [x], message="This is x: ")
# tf.reduce_sum(x, 1, keepdims=True)  # [[3], [3]]
# x = tf.Print(x, [x], message="This is x: ")
# tf.reduce_sum(x, [0, 1])  # 6
# x = tf.Print(x, [x], message="This is x: ")

# sess.eval()