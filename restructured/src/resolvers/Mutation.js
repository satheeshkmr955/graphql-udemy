import uuidv4 from 'uuid/v4'

const Mutation = {
    createUser(parent, args, { db }, info) {
        const emailTaken = db.users.some((user) => user.email === args.data.email)

        if (emailTaken) {
            throw new Error('Email taken')
        }

        const user = {
            id: uuidv4(),
            ...args.data
        }

        db.users.push(user)

        return user
    },
    deleteUser(parent, args, { db }, info) {
        const userIndex = db.users.findIndex((user) => user.id === args.id)

        if (userIndex === -1) {
            throw new Error('User not found')
        }

        const deletedUsers = db.users.splice(userIndex, 1)

        db.posts = db.posts.filter((post) => {
            const match = post.author === args.id

            if (match) {
                db.comments = db.comments.filter((comment) => comment.post !== post.id)
            }

            return !match
        })
        db.comments = db.comments.filter((comment) => comment.author !== args.id)

        return deletedUsers[0]
    },
    updateUser(parent, args, { db }, info) {
        const user = db.users.find((user) => user.id === args.id);

        if(!user) {
            throw new Error('User cannot be found')
        }
        if(typeof args.data.email === 'string') {
            const emailTaken = db.users.some((user) => user.email === args.data.email)
            if(emailTaken) {
                throw new Error ('email is already taken')
            }
            user.email = args.data.email
            console.log(`here it is again: ${user.email}`)
        }
        if(typeof args.data.name === 'string') {
            user.name = args.data.name
        }
        if(typeof args.data.age !== 'undefined') {
            user.age = args.data.age
        }
        return user
    },
    createPost(parent, args, { db, pubsub }, info) {
        const userExists = db.users.some((user) => user.id === args.data.author)

        if (!userExists) {
            throw new Error('User not found')
        }

        const post = {
            id: uuidv4(),
            ...args.data
        }

        db.posts.push(post)
        if(args.data.published) { 
            pubsub.publish('post', { 
                post: {
                    mutation: 'CREATED',
                    data: post
                }
            }) 
        }

        return post
    },
    updatePost(parent, args, { db, pubsub }, info) {
        const thePost = db.posts.find((post) => post.id === args.id)
        const originalPost = {...thePost}
        if(!thePost) {
            throw new Error('Post not found')
        }

        if(typeof args.data.title === 'string') {
            thePost.title = args.data.title
        }
        if(typeof args.data.body === 'string') {
            thePost.body = args.data.body
        }
        if(typeof args.data.published === 'boolean') {
            thePost.published = args.data.published
            if(originalPost.published && !thePost.published) {
                pubsub.publish('post', { 
                    post: {
                        mutation: 'DELETED',
                        data: originalPost
                    }
                })
            }
            else if(!originalPost.published && thePost.published) {
                pubsub.publish('post', { 
                    post: {
                        mutation: 'CREATED',
                        data: thePost
                    }
                })
            }
        }
        else if(thePost.published) {
            pubsub.publish('post', { 
                post: {
                    mutation: 'UPDATED',
                    data: thePost
                }
            }) 
        }
           
        return thePost
    },
    deletePost(parent, args, { db }, info) {
        const postIndex = db.posts.findIndex((post) => post.id === args.id)

        if (postIndex === -1) {
            throw new Error('Post not found')
        }

        const [post] = db.posts.splice(postIndex, 1)

        db.comments = db.comments.filter((comment) => comment.post !== args.id)
        if(post.published) {
            pubsub.publish('post', { 
                post: {
                    mutation: 'DELETED',
                    data: post
                } 
            }) 
        }
        
        return post
    },
    createComment(parent, args, { db, pubsub }, info) {
        const userExists = db.users.some((user) => user.id === args.data.author)
        const postExists = db.posts.some((post) => post.id === args.data.post && post.published)

        if (!userExists || !postExists) {
            throw new Error('Unable to find user and post')
        }

        const comment = {
            id: uuidv4(),
            ...args.data
        }

        db.comments.push(comment)
        pubsub.publish(`comment:${args.data.post}`, { 
            comment: {
                mutation: 'CREATED',
                data: comment
            }
        })
        return comment
    },
    deleteComment(parent, args, { db, pubsub }, info) {
        const commentIndex = db.comments.findIndex((comment) => comment.id === args.id)

        if (commentIndex === -1) {
            throw new Error('Comment not found')
        }

        const deletedComments = db.comments.splice(commentIndex, 1)
        pubsub.publish(`comment:${deletedComments[0].post}`, {
            comment: {
                mutation: 'DELETED',
                data: deletedComments
            }
        })
        return deletedComments[0]
    },
    updateComment(parent, args, { db, pubsub }, info) {
        const { id, data } = args
        const theComment = db.comments.find((comment) => comment.id === id)

        if(!theComment) {
            throw new Error ('comment not found')
        }

        if(typeof data.text === 'string') {
            theComment.text = data.text
        }

        pubsub.publish(`comment:${theComment.post}`, {
            comment: {
                mutation: 'UPDATED',
                data: theComment
            }
        })
        return theComment
    }
}

export { Mutation as default }